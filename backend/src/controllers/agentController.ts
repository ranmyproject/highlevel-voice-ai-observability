import type { Request, Response } from "express";

import { HttpError } from "../errors/HttpError.js";
import { agentRepository } from "../repositories/agentRepository.js";
import { agentFeedbackCycleRepository } from "../repositories/agentFeedbackCycleRepository.js";
import { kpiRepository } from "../repositories/kpiRepository.js";
import { agentService } from "../services/agentService.js";
import { agentKpiDerivationService } from "../services/agentKpiDerivationService.js";
import { agentSynthesisService } from "../services/agentSynthesisService.js";
import { observabilityService } from "../services/observabilityService.js";
import { callService } from "../services/callService.js";
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
  const result = await callService.buildAgentWorkspace(
    String(request.params.agentId),
    request.locationId
  );
  response.json(result);
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

function normalizeRecommendationIds(body: unknown): string[] {
  if (!body || typeof body !== "object") {
    return [];
  }

  const payload = body as { recommendationId?: unknown; recommendationIds?: unknown };
  const idsFromArray = Array.isArray(payload.recommendationIds)
    ? payload.recommendationIds
        .filter((id): id is string => typeof id === "string")
        .map((id) => id.trim())
        .filter(Boolean)
    : [];
  const ids =
    idsFromArray.length > 0
      ? idsFromArray
      : typeof payload.recommendationId === "string" && payload.recommendationId.trim().length > 0
        ? [payload.recommendationId.trim()]
        : [];

  const deduped: string[] = [];
  const seen = new Set<string>();
  for (const id of ids) {
    if (!seen.has(id)) {
      seen.add(id);
      deduped.push(id);
    }
  }
  return deduped;
}

interface ApplyRecommendationsResult {
  success: true;
  agentId: string;
  appliedAt: string;
  appliedCount: number;
  appliedRecommendationIds: string[];
  remainingRecommendationCount: number;
  promptFieldKey: string;
  updatedPromptPreview: string;
  refreshRecommended: boolean;
}

async function applyPromptRecommendations(
  locationId: string,
  agentId: string,
  recommendationIds: string[]
): Promise<ApplyRecommendationsResult> {
  if (recommendationIds.length === 0) {
    throw new HttpError(400, "recommendationIds is required in request body");
  }

  const agent = await agentRepository.findOne(locationId, agentId);
  if (!agent) {
    throw new HttpError(404, "Agent not found");
  }

  const allRecommendations = agent.recommendations || [];
  if (allRecommendations.length === 0) {
    throw new HttpError(404, "No recommendations found on this agent");
  }

  const recommendationsById = new Map(allRecommendations.map((recommendation) => [recommendation.id, recommendation]));
  const missingIds = recommendationIds.filter((id) => !recommendationsById.has(id));
  if (missingIds.length > 0) {
    throw new HttpError(404, `Recommendation(s) not found on this agent: ${missingIds.join(", ")}`);
  }

  const selectedRecommendations = recommendationIds.map((id) => recommendationsById.get(id)!);
  const nonPromptRecommendations = selectedRecommendations.filter((recommendation) => recommendation.owner !== "prompt");
  if (nonPromptRecommendations.length > 0) {
    const details = nonPromptRecommendations
      .map((recommendation) => `"${recommendation.title}" (${recommendation.owner})`)
      .join(", ");
    throw new HttpError(400, `Only prompt recommendations can be auto-applied. Invalid selection: ${details}`);
  }

  logger.info("applyRecommendations", "Generating prompt patch for selected recommendations", {
    locationId,
    agentId,
    recommendationCount: selectedRecommendations.length,
    recommendationIds,
  });

  const { promptFieldKey, updatedPrompt } = await agentSynthesisService.generatePromptPatchForRecommendations(
    agent,
    selectedRecommendations
  );

  logger.info("applyRecommendations", "Prompt patch generated, pushing to HighLevel", {
    locationId,
    agentId,
    promptFieldKey,
  });

  await agentService.patchAgent(locationId, agentId, {
    [promptFieldKey]: updatedPrompt,
  });

  const appliedAt = new Date().toISOString();
  const selectedIdSet = new Set(recommendationIds);
  const remainingRecommendations = allRecommendations.filter((recommendation) => !selectedIdSet.has(recommendation.id));
  const updatedLatestFeedbackCycle = agent.latestFeedbackCycle
    ? {
        ...agent.latestFeedbackCycle,
        recommendations: remainingRecommendations,
        nextActions: remainingRecommendations.map((recommendation) => recommendation.title)
      }
    : undefined;

  const updatedDetailPayload = {
    ...(agent.detailPayload as Record<string, unknown>),
    [promptFieldKey]: updatedPrompt,
  } as import("../types.js").AgentDetail;

  await agentRepository.upsertMany([
    {
      ...agent,
      detailPayload: updatedDetailPayload,
      recommendations: remainingRecommendations,
      latestFeedbackCycle: updatedLatestFeedbackCycle,
      lastPromptUpdateAt: appliedAt,
      lastAppliedRecommendationIds: recommendationIds,
    }
  ]);

  if (updatedLatestFeedbackCycle) {
    await agentFeedbackCycleRepository.upsert(updatedLatestFeedbackCycle);
  }

  logger.info("applyRecommendations", "Recommendations applied successfully", {
    locationId,
    agentId,
    recommendationCount: recommendationIds.length,
    recommendationIds,
  });

  return {
    success: true,
    agentId,
    appliedAt,
    appliedCount: recommendationIds.length,
    appliedRecommendationIds: recommendationIds,
    remainingRecommendationCount: remainingRecommendations.length,
    promptFieldKey,
    updatedPromptPreview: updatedPrompt.slice(0, 300) + (updatedPrompt.length > 300 ? "…" : ""),
    refreshRecommended: true,
  };
}

export async function applyRecommendation(
  request: Request,
  response: Response
): Promise<void> {
  const locationId = request.locationId;
  const agentId = String(request.params.agentId);
  const recommendationIds = normalizeRecommendationIds(request.body);

  if (recommendationIds.length !== 1) {
    throw new HttpError(400, "recommendationId is required in request body");
  }

  const result = await applyPromptRecommendations(locationId, agentId, recommendationIds);
  response.json({
    ...result,
    recommendationId: recommendationIds[0],
  });
}

export async function applyRecommendations(
  request: Request,
  response: Response
): Promise<void> {
  const locationId = request.locationId;
  const agentId = String(request.params.agentId);
  const recommendationIds = normalizeRecommendationIds(request.body);

  if (recommendationIds.length === 0) {
    throw new HttpError(400, "recommendationIds is required in request body");
  }

  const result = await applyPromptRecommendations(locationId, agentId, recommendationIds);
  response.json(result);
}
