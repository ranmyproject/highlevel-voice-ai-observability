import { env } from "../config/env.js";
import { HttpError } from "../errors/HttpError.js";
import { callRepository } from "../repositories/callRepository.js";
import { agentRepository } from "../repositories/agentRepository.js";
import { kpiRepository } from "../repositories/kpiRepository.js";
import { callEvaluationRepository } from "../repositories/callEvaluationRepository.js";
import { callMonitorRepository } from "../repositories/callMonitorRepository.js";
import { agentFeedbackCycleRepository } from "../repositories/agentFeedbackCycleRepository.js";
import { authService } from "./authService.js";
import {
  buildTranscriptFingerprint,
  transcriptEvaluationService
} from "./transcriptEvaluationService.js";
import { agentSynthesisService } from "./agentSynthesisService.js";
import { callMonitoringService } from "./callMonitoringService.js";
import { agentFeedbackFlywheelService } from "./agentFeedbackFlywheelService.js";
import { logger } from "../utils/logger.js";
import type {
  AgentAggregates,
  AgentAnalysisWorkspace,
  AgentKpiAggregate,
  AgentKpiItem,
  AgentRecommendation,
  KpiStatus,
  StoredAgent,
  StoredVoiceCall,
  TranscriptEvaluation,
  VoiceCall,
  VoiceCallDetail,
  VoiceCallListResponse
} from "../types.js";

function readString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function readNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function readObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function extractItems<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) {
    return payload as T[];
  }

  if (payload && typeof payload === "object") {
    const candidate = payload as Record<string, unknown>;
    if (Array.isArray(candidate.callLogs)) return candidate.callLogs as T[];
    if (Array.isArray(candidate.calls)) return candidate.calls as T[];
    if (Array.isArray(candidate.data)) return candidate.data as T[];
    if (Array.isArray(candidate.items)) return candidate.items as T[];
  }

  return [];
}

function statusToScore(status: KpiStatus): number {
  if (status === "achieved") return 100;
  if (status === "deviated") return 50;
  return 0;
}

function computeAggregates(
  evaluations: TranscriptEvaluation[],
  totalCalls: number,
  blueprintKpis: AgentKpiItem[]
): AgentAggregates {
  const evaluatedCalls = evaluations.length;
  const goalAchievedCount = evaluations.filter((e) => e.goalAchieved).length;
  const kpiTextMap = new Map(blueprintKpis.map((k) => [k.id, k.kpi]));

  // Average of per-call scores (each call's score = avg of its non-skipped KPI scores)
  const scoreSum = evaluations.reduce((sum, ev) => sum + ev.overallScore, 0);

  // KPI status counts across all evaluations
  const kpiMap = new Map<
    string,
    { kpi: string; achieved: number; deviated: number; failed: number; missed: number; total: number }
  >();

  for (const ev of evaluations) {
    for (const result of ev.kpiResults) {
      if (result.status === "skipped" || result.status === "unreachable") continue;

      let entry = kpiMap.get(result.kpiId);
      if (!entry) {
        entry = {
          kpi: kpiTextMap.get(result.kpiId) ?? result.kpi,
          achieved: 0, deviated: 0, failed: 0, missed: 0, total: 0
        };
        kpiMap.set(result.kpiId, entry);
      }

      entry.total++;
      if (result.status === "achieved") entry.achieved++;
      else if (result.status === "deviated") entry.deviated++;
      else if (result.status === "failed") entry.failed++;
      else if (result.status === "missed") entry.missed++;
    }
  }

  const kpiAggregates: AgentKpiAggregate[] = [...kpiMap.entries()].map(
    ([kpiId, v]) => ({ kpiId, kpi: v.kpi, achieved: v.achieved, deviated: v.deviated, failed: v.failed, missed: v.missed, total: v.total })
  );

  const topFailures = [...kpiAggregates]
    .filter((k) => k.failed > 0)
    .sort((a, b) => b.failed - a.failed)
    .slice(0, 5)
    .map((k) => k.kpi);

  const topDeviations = [...kpiAggregates]
    .filter((k) => k.deviated > 0)
    .sort((a, b) => b.deviated - a.deviated)
    .slice(0, 5)
    .map((k) => k.kpi);

  const topMissed = [...kpiAggregates]
    .filter((k) => k.missed > 0)
    .sort((a, b) => b.missed - a.missed)
    .slice(0, 5)
    .map((k) => k.kpi);

  return {
    totalCalls,
    evaluatedCalls,
    overallScore: evaluatedCalls > 0 ? Math.round(scoreSum / evaluatedCalls) : 0,
    goalAchievementRate:
      evaluatedCalls > 0 ? Math.round((goalAchievedCount / evaluatedCalls) * 100) : 0,
    kpiAggregates,
    topFailures,
    topDeviations,
    topMissed,
    lastEvaluatedAt: new Date().toISOString()
  };
}

class CallService {
  private async requestJson<T>(
    path: string,
    locationId?: string,
    retry = true,
    extraQuery?: Record<string, string | undefined>
  ): Promise<T> {
    const tokenRecord = await authService.getValidToken(locationId);
    const resolvedLocationId = locationId ?? tokenRecord.locationId;
    const search = new URLSearchParams();
    if (resolvedLocationId) {
      search.set("locationId", resolvedLocationId);
    }
    for (const [key, value] of Object.entries(extraQuery || {})) {
      if (value) {
        search.set(key, value);
      }
    }
    const qs = search.toString() ? `?${search.toString()}` : "";
    const url = `${env.highlevelApiBaseUrl}${path}${qs}`;

    logger.info("CallService", `→ GET ${path}`, { url, locationId: resolvedLocationId });

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${tokenRecord.accessToken}`,
        Version: "2021-07-28",
        Accept: "application/json"
      }
    });

    logger.debug("CallService", `← ${response.status} ${response.statusText} for ${path}`);

    if (response.status === 401 && retry) {
      logger.warn("CallService", `401 Unauthorized for ${path}, refreshing token and retrying`, { locationId });
      await authService.refreshToken(locationId);
      return this.requestJson<T>(path, locationId, false, extraQuery);
    }

    if (!response.ok) {
      const body = await response.text();
      logger.error("CallService", `HighLevel API error for ${path}`, { status: response.status, body });
      throw new HttpError(response.status, `HighLevel call request failed for ${path}: ${body}`);
    }

    return (await response.json()) as T;
  }

  private normalizeCall(
    locationId: string,
    companyId: string | undefined,
    listItem: VoiceCall,
    detail: VoiceCallDetail
  ): StoredVoiceCall | null {
    const id = readString(listItem.id || detail.id);
    const agentId =
      readString(listItem.agentId) ||
      readString(detail.agentId) ||
      readString(detail.voiceAgentId) ||
      readString(detail.aiAgentId);

    if (!id || !agentId) return null;

    return {
      id,
      locationId,
      companyId,
      agentId,
      caller:
        readString(listItem.caller) ||
        readString(detail.caller) ||
        readString(detail.contactName) ||
        "Unknown caller",
      durationSec: readNumber(listItem.duration || detail.duration || detail.durationSec),
      status: readString(listItem.status || detail.status) || "unknown",
      transcript: readString(detail.transcript || listItem.transcript),
      summary: readString(detail.summary || listItem.summary),
      extractedData: readObject(detail.extractedData),
      startedAt: readString(listItem.createdAt || detail.createdAt) || undefined,
      lastUpdatedAt: readString(listItem.updatedAt || detail.updatedAt) || undefined,
      listPayload: listItem,
      detailPayload: detail,
      syncedAt: new Date().toISOString()
    };
  }

  async fetchCalls(
    locationId: string,
    agentId: string
  ): Promise<StoredVoiceCall[]> {
    logger.info("CallService", "fetchCalls started", { locationId, agentId });

    const tokenRecord = await authService.getValidToken(locationId);

    const listPayload = await this.requestJson<unknown>(
      "/voice-ai/dashboard/call-logs",
      locationId,
      true,
      { agentId }
    );
    const listItems = extractItems<VoiceCall>(listPayload);

    logger.info("CallService", "Fetched call log list from HL", { count: listItems.length, locationId, agentId });

    const results = await Promise.all(
      listItems.map(async (listItem) => {
        const callId = readString(listItem.id);
        if (!callId) return null;

        const detailPayload = await this.requestJson<VoiceCallDetail>(
          `/voice-ai/dashboard/call-logs/${callId}`,
          locationId
        );

        return this.normalizeCall(locationId, tokenRecord.companyId, listItem, detailPayload);
      })
    );

    const calls = results.filter((item): item is StoredVoiceCall => item !== null);

    logger.info("CallService", "fetchCalls completed", { fetchedCount: calls.length, locationId, agentId });
    return calls;
  }

  async listCalls(locationId?: string, agentId?: string): Promise<VoiceCallListResponse> {
    const tokenRecord = await authService.getValidToken(locationId);
    const resolvedLocationId = tokenRecord.locationId;

    if (!resolvedLocationId) {
      throw new HttpError(400, "No locationId available for HighLevel calls");
    }

    const calls = agentId
      ? await callRepository.findByAgentId(resolvedLocationId, agentId)
      : await callRepository.findByLocationId(resolvedLocationId);

    return {
      locationId: resolvedLocationId,
      syncedAt: calls[0]?.syncedAt || "",
      count: calls.length,
      calls
    };
  }

  async analyzeCall(callId: string, locationId?: string): Promise<TranscriptEvaluation> {
    logger.info("CallService", "analyzeCall started", { callId, locationId });

    const tokenRecord = await authService.getValidToken(locationId);
    const resolvedLocationId = tokenRecord.locationId;

    if (!resolvedLocationId) {
      throw new HttpError(400, "No locationId available for transcript analysis");
    }

    const call = await callRepository.findOne(resolvedLocationId, callId);
    if (!call) throw new HttpError(404, "Stored HighLevel call not found");

    const agent = await agentRepository.findOne(resolvedLocationId, call.agentId);
    if (!agent) throw new HttpError(404, "Stored HighLevel agent not found for this call");

    const blueprint = await kpiRepository.findByAgentId(resolvedLocationId, call.agentId);
    if (!blueprint || blueprint.kpis.length === 0) {
      throw new HttpError(400, "No KPI blueprint found for this agent. Sync agents first.");
    }

    return this.evaluateCall(call, agent, blueprint.kpis, resolvedLocationId);
  }

  private async evaluateCall(
    call: StoredVoiceCall,
    agent: StoredAgent,
    kpis: AgentKpiItem[],
    resolvedLocationId: string
  ): Promise<TranscriptEvaluation> {
    const monitor = call.monitor ?? callMonitoringService.evaluateCall(call, agent);
    await callRepository.writeMonitor(resolvedLocationId, call.id, monitor);
    await callMonitorRepository.upsertMany([monitor]);

    const transcriptFingerprint = buildTranscriptFingerprint(call);

    const existingEvaluation = await callEvaluationRepository.findByCallId(resolvedLocationId, call.id);
    if (
      existingEvaluation &&
      existingEvaluation.transcriptFingerprint === transcriptFingerprint &&
      existingEvaluation.agentMetadataFingerprint === agent.metadataFingerprint
    ) {
      logger.info("CallService", "Using cached evaluation", { callId: call.id });
      return existingEvaluation;
    }

    logger.info("CallService", "Running transcript evaluation", { callId: call.id, agentId: agent.id });
    const evaluation = await transcriptEvaluationService.evaluate(call, agent, kpis);
    await callEvaluationRepository.upsert(evaluation);

    logger.info("CallService", "analyzeCall completed", { callId: call.id });
    return evaluation;
  }

  async analyzeAgentCalls(
    agentId: string,
    locationId?: string
  ): Promise<{ analyzedCount: number; evaluations: TranscriptEvaluation[]; feedbackCycle: import("../types.js").AgentFeedbackCycle }> {
    logger.info("CallService", "analyzeAgentCalls started", { agentId, locationId });

    const tokenRecord = await authService.getValidToken(locationId);
    const resolvedLocationId = tokenRecord.locationId;

    if (!resolvedLocationId) {
      throw new HttpError(400, "No locationId available for batch analysis");
    }

    const [calls, agent] = await Promise.all([
      callRepository.findByAgentId(resolvedLocationId, agentId),
      agentRepository.findOne(resolvedLocationId, agentId)
    ]);

    if (!agent) throw new HttpError(404, "Stored HighLevel agent not found");

    const monitorDecisions = calls.map((call) => {
      const decision = call.monitor ?? callMonitoringService.evaluateCall(call, agent);
      call.monitor = decision;
      return decision;
    });

    await callMonitorRepository.upsertMany(monitorDecisions);
    await Promise.all(
      monitorDecisions.map((decision) =>
        callRepository.writeMonitor(resolvedLocationId, decision.callId, decision)
      )
    );

    const callsToAnalyze = calls.filter((call) => call.monitor?.shouldAnalyze);

    // Fetch agent context once — shared across all calls in every batch
    const blueprint = await kpiRepository.findByAgentId(resolvedLocationId, agentId);
    if (!blueprint || blueprint.kpis.length === 0) {
      throw new HttpError(400, "No KPI blueprint found for this agent. Sync agents first.");
    }

    // Process in batches of 10 — parallel within each batch, sequential across batches
    // Each evaluation is saved to DB as soon as it completes inside evaluateCall
    const BATCH_SIZE = 10;
    const evaluations: TranscriptEvaluation[] = [];

    for (let i = 0; i < callsToAnalyze.length; i += BATCH_SIZE) {
      const batch = callsToAnalyze.slice(i, i + BATCH_SIZE);
      logger.info("CallService", `Processing batch ${Math.floor(i / BATCH_SIZE) + 1}`, {
        agentId,
        batchSize: batch.length,
        total: callsToAnalyze.length
      });
      const batchResults = await Promise.all(
        batch.map((call) => this.evaluateCall(call, agent, blueprint.kpis, resolvedLocationId))
      );
      evaluations.push(...batchResults);
    }

    const [storedCalls, storedEvaluations] = await Promise.all([
      callRepository.findByAgentId(resolvedLocationId, agentId),
      callEvaluationRepository.findByAgentId(resolvedLocationId, agentId)
    ]);

    const aggregates = computeAggregates(storedEvaluations, storedCalls.length, blueprint.kpis);
    await agentRepository.setAggregates(resolvedLocationId, agentId, aggregates);

    const recommendations =
      aggregates.evaluatedCalls > 0 ? await agentSynthesisService.synthesize(agent, aggregates) : [];
    await agentRepository.setRecommendations(resolvedLocationId, agentId, recommendations);

    const feedbackCycle = agentFeedbackFlywheelService.buildCycle(
      { ...agent, aggregates, recommendations },
      monitorDecisions,
      aggregates,
      recommendations
    );
    await agentFeedbackCycleRepository.upsert(feedbackCycle);
    await agentRepository.setLatestFeedbackCycle(resolvedLocationId, agentId, feedbackCycle);

    logger.info("CallService", "analyzeAgentCalls completed", { agentId, analyzedCount: evaluations.length });

    return { analyzedCount: evaluations.length, evaluations, feedbackCycle };
  }

  async synthesizeAgentInsights(
    agentId: string,
    locationId?: string
  ): Promise<{ recommendations: AgentRecommendation[] }> {
    logger.info("CallService", "synthesizeAgentInsights started", { agentId, locationId });

    const tokenRecord = await authService.getValidToken(locationId);
    const resolvedLocationId = tokenRecord.locationId;

    if (!resolvedLocationId) {
      throw new HttpError(400, "No locationId available for synthesis");
    }

    const agent = await agentRepository.findOne(resolvedLocationId, agentId);
    if (!agent) throw new HttpError(404, "Stored HighLevel agent not found");

    if (!agent.aggregates || agent.aggregates.evaluatedCalls === 0) {
      throw new HttpError(400, "No evaluated calls found. Run analysis first before synthesizing insights.");
    }

    const recommendations = await agentSynthesisService.synthesize(agent, agent.aggregates);
    await agentRepository.setRecommendations(resolvedLocationId, agentId, recommendations);

    const monitors = await callMonitorRepository.findByAgentId(resolvedLocationId, agentId);
    const feedbackCycle = agentFeedbackFlywheelService.buildCycle(
      {
        ...agent,
        recommendations
      },
      monitors,
      agent.aggregates,
      recommendations
    );
    await agentFeedbackCycleRepository.upsert(feedbackCycle);
    await agentRepository.setLatestFeedbackCycle(resolvedLocationId, agentId, feedbackCycle);

    logger.info("CallService", "synthesizeAgentInsights completed", { agentId, recommendationCount: recommendations.length });

    return { recommendations };
  }

  async buildAgentWorkspace(
    agentId: string,
    locationId?: string
  ): Promise<AgentAnalysisWorkspace> {
    const tokenRecord = await authService.getValidToken(locationId);
    const resolvedLocationId = tokenRecord.locationId;

    if (!resolvedLocationId) {
      throw new HttpError(400, "No locationId available for workspace");
    }

    const [agent, calls, kpiBlueprint, evaluations] = await Promise.all([
      agentRepository.findOne(resolvedLocationId, agentId),
      callRepository.findByAgentId(resolvedLocationId, agentId),
      kpiRepository.findByAgentId(resolvedLocationId, agentId),
      callEvaluationRepository.findByAgentId(resolvedLocationId, agentId)
    ]);

    if (!agent) throw new HttpError(404, "Stored HighLevel agent not found");

    return { agent, kpiBlueprint, calls, evaluations };
  }
}

export const callService = new CallService();
