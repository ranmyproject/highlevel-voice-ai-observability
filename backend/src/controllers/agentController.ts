import type { Request, Response } from "express";

import { HttpError } from "../errors/HttpError.js";
import { agentRepository } from "../repositories/agentRepository.js";
import { kpiRepository } from "../repositories/kpiRepository.js";
import { agentService } from "../services/agentService.js";
import { agentKpiDerivationService } from "../services/agentKpiDerivationService.js";
import { observabilityService } from "../services/observabilityService.js";

const BATCH_SIZE = 10;

export async function syncAgents(
  request: Request,
  response: Response
): Promise<void> {
  const locationId = request.locationId;

  // 1. Fetch all agents from HL API (list + detail for each)
  const fetchResults = await agentService.fetchAgents(locationId);

  // 2. Load existing agents from DB for change detection
  const existingAgents = await agentRepository.findByLocationId(locationId);
  const existingMap = new Map(existingAgents.map((a) => [a.id, a]));

  // 3. Save all fetched agents to DB immediately with their raw HL data
  await agentRepository.upsertMany(fetchResults.map((r) => r.agent));

  // 4. Determine which agents need KPI derivation:
  //    - new agents not yet in DB
  //    - agents whose HL updatedAt has changed
  //    - agents already in DB but with missing/empty derivedProfile (e.g. prior LLM failure)
  const agentsToUpdate = fetchResults.filter(({ listItem, agent }) => {
    const existing = existingMap.get(agent.id);
    const hlUpdatedAt = typeof listItem.updatedAt === "string" ? listItem.updatedAt : "";
    const isNew = !existing;
    const isChanged = hlUpdatedAt !== "" && existing?.lastUpdatedAt !== hlUpdatedAt;
    const isIncomplete = existing && !existing.derivedProfile?.primaryGoal;
    return isNew || isChanged || isIncomplete;
  });

  // 5. Derive KPIs in batches of 10 — parallel within each batch, sequential across batches
  for (let i = 0; i < agentsToUpdate.length; i += BATCH_SIZE) {
    const batch = agentsToUpdate.slice(i, i + BATCH_SIZE);

    const batchResults = await Promise.all(
      batch.map(async ({ agent }) => {
        const existingAgent = existingMap.get(agent.id) ?? null;
        const existingBlueprint = existingAgent
          ? await kpiRepository.findByAgentId(agent.locationId, agent.id)
          : null;

        const derived = await agentKpiDerivationService.deriveAgentKpis(
          agent.detailPayload,
          agent.listPayload,
          existingAgent,
          existingBlueprint?.kpis
        );

        agent.goal = derived.goal;
        agent.derivedProfile = derived.derivedProfile;
        agent.kpiGeneratedAt = derived.kpiGeneratedAt;
        agent.kpiGenerationSource = derived.kpiGenerationSource;
        agent.metadataFingerprint = derived.metadataFingerprint;

        return { agent, derived };
      })
    );

    // Persist blueprints and enriched agents for this batch in parallel
    await Promise.all([
      ...batchResults.map(({ agent, derived }) =>
        kpiRepository.upsert({
          agentId: agent.id,
          locationId: agent.locationId,
          kpis: derived.kpis,
          generatedAt: derived.kpiGeneratedAt,
          source: "llm",
          metadataFingerprint: derived.metadataFingerprint
        })
      ),
      agentRepository.upsertMany(batchResults.map((r) => r.agent))
    ]);
  }

  const allAgents = await agentRepository.findByLocationId(locationId);

  response.status(200).json({
    locationId,
    syncedAt: new Date().toISOString(),
    count: allAgents.length,
    agents: allAgents
  });
}

export async function listAgents(
  request: Request,
  response: Response
): Promise<void> {
  const locationId = request.locationId;

  const agents = await agentRepository.findByLocationId(locationId);

  response.json({
    locationId,
    syncedAt: agents[0]?.syncedAt || "",
    count: agents.length,
    agents
  });
}

export async function getAgent(
  request: Request,
  response: Response
): Promise<void> {
  const locationId = request.locationId;

  const agent = await agentRepository.findOne(
    locationId,
    String(request.params.agentId)
  );

  if (!agent) {
    throw new HttpError(404, "Agent not found");
  }

  response.json(agent);
}

export async function getAgentAnalysis(
  request: Request,
  response: Response
): Promise<void> {
  const locationId = request.locationId;

  const analysis = await observabilityService.getAgentAnalysis(
    locationId,
    String(request.params.agentId)
  );

  if (!analysis) {
    throw new HttpError(404, "Agent analysis not found");
  }

  response.json(analysis);
}

