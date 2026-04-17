import type { Request, Response } from "express";

import { HttpError } from "../errors/HttpError.js";
import { agentRepository } from "../repositories/agentRepository.js";
import { kpiRepository } from "../repositories/kpiRepository.js";
import { agentService } from "../services/agentService.js";
import { agentKpiDerivationService } from "../services/agentKpiDerivationService.js";
import { agentSynthesisService } from "../services/agentSynthesisService.js";
import { observabilityService } from "../services/observabilityService.js";
import { logger } from "../utils/logger.js";
import type { StoredAgent } from "../types.js";

const BATCH_SIZE = 10;

async function performSync(locationId: string): Promise<StoredAgent[]> {
  const fetchResults = await agentService.fetchAgents(locationId);

  const existingAgents = await agentRepository.findByLocationId(locationId);
  const existingMap = new Map(existingAgents.map((a) => [a.id, a]));

  await agentRepository.upsertMany(fetchResults.map((r) => r.agent));

  const agentsToUpdate = fetchResults.filter(({ listItem, agent }) => {
    const existing = existingMap.get(agent.id);
    const hlUpdatedAt = typeof listItem.updatedAt === "string" ? listItem.updatedAt : "";
    const isNew = !existing;
    const isChanged = hlUpdatedAt !== "" && existing?.lastUpdatedAt !== hlUpdatedAt;
    const isIncomplete = existing && !existing.derivedProfile?.primaryGoal;
    return isNew || isChanged || isIncomplete;
  });

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

  return agentRepository.findByLocationId(locationId);
}

export async function syncAgents(
  request: Request,
  response: Response
): Promise<void> {
  const agents = await performSync(request.locationId);

  response.status(200).json({
    locationId: request.locationId,
    syncedAt: new Date().toISOString(),
    count: agents.length,
    agents
  });
}

export async function listAgents(
  request: Request,
  response: Response
): Promise<void> {
  const locationId = request.locationId;

  let agents = await agentRepository.findByLocationId(locationId);

  if (agents.length === 0) {
    agents = await performSync(locationId);
  }

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

export async function applyRecommendation(
  request: Request,
  response: Response
): Promise<void> {
  const locationId = request.locationId;
  const agentId = String(request.params.agentId);
  const { recommendationId } = request.body as { recommendationId?: string };

  if (!recommendationId) {
    throw new HttpError(400, "recommendationId is required in request body");
  }

  // 1. Load the stored agent
  const agent = await agentRepository.findOne(locationId, agentId);
  if (!agent) {
    throw new HttpError(404, "Agent not found");
  }

  // 2. Find the matching recommendation
  const recommendation = agent.recommendations?.find((r) => r.id === recommendationId);
  if (!recommendation) {
    throw new HttpError(404, `Recommendation "${recommendationId}" not found on this agent`);
  }

  // 3. Only "prompt" owner recommendations can be auto-applied
  if (recommendation.owner !== "prompt") {
    throw new HttpError(
      400,
      `Recommendation "${recommendation.title}" is owned by "${recommendation.owner}" — only prompt-type recommendations can be auto-applied via this endpoint`
    );
  }

  logger.info("applyRecommendation", "Generating prompt patch", {
    locationId,
    agentId,
    recommendationId,
  });

  // 4. Use LLM to generate the updated prompt
  const { promptFieldKey, updatedPrompt } = await agentSynthesisService.generatePromptPatch(
    agent,
    recommendation
  );

  logger.info("applyRecommendation", "Prompt patch generated, pushing to HighLevel", {
    locationId,
    agentId,
    promptFieldKey,
  });

  // 5. Push to HighLevel via PATCH /voice-ai/agents/:agentId
  await agentService.patchAgent(locationId, agentId, {
    [promptFieldKey]: updatedPrompt,
  });

  // 6. Update the detailPayload locally so future reads reflect the new prompt
  const updatedDetailPayload = {
    ...(agent.detailPayload as Record<string, unknown>),
    [promptFieldKey]: updatedPrompt,
  } as import("../types.js").AgentDetail;

  await agentRepository.upsertMany([
    { ...agent, detailPayload: updatedDetailPayload }
  ]);

  logger.info("applyRecommendation", "Recommendation applied successfully", {
    locationId,
    agentId,
    recommendationId,
  });

  response.json({
    success: true,
    agentId,
    recommendationId,
    appliedAt: new Date().toISOString(),
    promptFieldKey,
    updatedPromptPreview: updatedPrompt.slice(0, 300) + (updatedPrompt.length > 300 ? "…" : ""),
  });
}
