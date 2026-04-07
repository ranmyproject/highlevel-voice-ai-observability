import { env } from "../config/env.js";
import { HttpError } from "../errors/HttpError.js";
import { agentRepository } from "../repositories/agentRepository.js";
import { authService } from "./authService.js";
import { logger } from "../utils/logger.js";
import {
  AgentDetail,
  AgentListItem,
  StoredAgent
} from "../types.js";

function readString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function extractItems<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) {
    return payload as T[];
  }

  if (payload && typeof payload === "object") {
    const candidate = payload as Record<string, unknown>;
    if (Array.isArray(candidate.agents)) return candidate.agents as T[];
    if (Array.isArray(candidate.data)) return candidate.data as T[];
    if (Array.isArray(candidate.items)) return candidate.items as T[];
  }

  return [];
}

function normalizeStatus(detail: AgentDetail): string {
  const status = detail.status || detail.agentStatus || "unknown";
  return typeof status === "string" ? status.toLowerCase() : "unknown";
}

function normalizeChannels(
  listItem: AgentListItem,
  detail: AgentDetail
): string[] {
  const channels = listItem.channels || detail.channels || [];
  return Array.isArray(channels) ? channels.map((c) => String(c)) : [];
}

class AgentService {
  private async requestJson<T>(
    path: string,
    locationId: string,
    method: "GET" | "POST" | "PUT" = "GET",
    bodyPayload?: unknown,
    retry = true
  ): Promise<T> {
    const tokenRecord = await authService.getValidToken(locationId);
    const url = `${env.highlevelApiBaseUrl}${path}?locationId=${locationId}`;

    logger.info("AgentService", `→ ${method} ${path}`, {
      url,
      locationId
    });

    const response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${tokenRecord.accessToken}`,
        Version: "2021-07-28",
        Accept: "application/json",
        "Content-Type": "application/json"
      },
      body: bodyPayload ? JSON.stringify(bodyPayload) : undefined
    });

    logger.info("AgentService", `← ${response.status} ${response.statusText} for ${path}`, {
      locationId,
    });

    if (response.status === 401 && retry) {
      logger.warn(
        "AgentService",
        `401 Unauthorized for ${path}, refreshing token and retrying`,
        { locationId, method }
      );
      await authService.refreshToken(locationId);
      return this.requestJson<T>(path, locationId, method, bodyPayload, false);
    }

    if (!response.ok) {
      const body = await response.text();

      if (response.status === 401 && method !== "GET") {
        throw new HttpError(
          401,
          `HighLevel rejected the ${method} request for ${path}. This usually means the installed token does not include Voice AI write permissions. Response: ${body}`
        );
      }

      logger.error("AgentService", `HighLevel API error for ${path}`, { status: response.status, body });
      throw new HttpError(
        response.status,
        `HighLevel agent request failed for ${path}: ${body}`
      );
    }

    return (await response.json()) as T;
  }

  private normalizeAgent(
    locationId: string,
    companyId: string | undefined,
    listItem: AgentListItem,
    detail: AgentDetail
  ): StoredAgent {
    const id = readString(listItem.id || detail.id);
    const name =
      readString(listItem.name) ||
      readString(detail.name) ||
      readString(detail.agentName) ||
      readString(listItem.agentName) ||
      "Untitled Agent";

    logger.info("AgentService", "Normalizing agent", { agentId: id, agentName: name });

    const status = normalizeStatus(detail);
    const channels = normalizeChannels(listItem, detail);
    const lastUpdatedAt =
      readString(listItem.updatedAt) ||
      readString(detail.updatedAt) ||
      readString(detail.lastUpdatedAt);
    const createdAt = readString(listItem.createdAt) || readString(detail.createdAt);

    const normalized: StoredAgent = {
      id,
      locationId,
      companyId,
      name,
      status,
      channels,
      goal: "",
      lastUpdatedAt: lastUpdatedAt || undefined,
      createdAt: createdAt || undefined,
      derivedProfile: {
        primaryGoal: "",
        secondaryGoals: [],
        workflowStages: [],
        requiredInformation: [],
        handoffActions: [],
        successOutcome: ""
      },
      kpiGeneratedAt: "",
      kpiGenerationSource: "fallback",
      metadataFingerprint: "",
      listPayload: listItem,
      detailPayload: detail,
      syncedAt: new Date().toISOString()
    };

    logger.info("AgentService", "Normalization complete", { agentId: id });
    return normalized;
  }

  async fetchAgents(locationId: string): Promise<{
    listItem: AgentListItem;
    agent: StoredAgent;
  }[]> {
    logger.info("AgentService", "fetchAgents started", { locationId });

    const tokenRecord = await authService.getValidToken(locationId);

    const listPayload = await this.requestJson<unknown>("/voice-ai/agents", locationId);
    const listItems = extractItems<AgentListItem>(listPayload);

    logger.info("AgentService", "Fetched agent list from HL", { count: listItems.length, locationId });

    const results = await Promise.all(
      listItems.map(async (listItem) => {
        const agentId = readString(listItem.id);

        if (!agentId) {
          logger.warn("AgentService", "Skipping agent with no id", { listItem });
          return null;
        }

        const detailPayload = await this.requestJson<AgentDetail>(
          `/voice-ai/agents/${agentId}`,
          locationId
        );

        const agent = this.normalizeAgent(
          locationId,
          tokenRecord.companyId,
          listItem,
          detailPayload
        );

        return { listItem, agent };
      })
    );

    const validResults = results.filter(
      (item): item is { listItem: AgentListItem; agent: StoredAgent } =>
        item !== null
    );

    logger.info("AgentService", "fetchAgents completed", { fetchedCount: validResults.length, locationId });
    return validResults;
  }

}

export const agentService = new AgentService();
