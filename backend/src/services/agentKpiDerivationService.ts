import { createHash } from "node:crypto";

import { env } from "../config/env.js";
import { HttpError } from "../errors/HttpError.js";
import { logger } from "../utils/logger.js";
import type {
  AgentDetail,
  AgentKpiItem,
  AgentListItem,
  DerivedAgentProfile,
  StoredAgent
} from "../types.js";

interface OpenAIResponseOutputText {
  text?: string;
}

interface OpenAIResponseEnvelope {
  output_text?: string;
  output?: Array<{
    content?: OpenAIResponseOutputText[];
  }>;
}

interface GeneratedAgentKpiResult {
  goal: string;
  derivedProfile: DerivedAgentProfile;
  kpis: AgentKpiItem[];
  source: "llm";
}

function stripMarkdownFences(value: string): string {
  return value.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
}

function safeJsonParse<T>(value: string): T | null {
  try {
    return JSON.parse(stripMarkdownFences(value)) as T;
  } catch {
    return null;
  }
}

function extractResponseText(payload: OpenAIResponseEnvelope): string {
  if (typeof payload.output_text === "string" && payload.output_text.length > 0) {
    return payload.output_text;
  }

  const content = payload.output?.flatMap((item) => item.content || []) || [];
  return content
    .map((item) => item.text || "")
    .join("\n")
    .trim();
}

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function toSnakeCase(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .trim()
    .replace(/\s+/g, "_")
    .slice(0, 60);
}

class AgentKpiDerivationService {
  buildMetadataFingerprint(
    detail: AgentDetail,
    listItem: AgentListItem
  ): string {
    const relevantPayload = {
      agentName: readString(detail.agentName || listItem.agentName || detail.name || listItem.name),
      welcomeMessage: readString(
        detail.welcomeMessage || listItem.welcomeMessage ||
        detail.firstMessage || listItem.firstMessage ||
        detail.openingMessage || listItem.openingMessage ||
        detail.greeting || listItem.greeting
      ),
      agentPrompt: readString(
        detail.agentPrompt || listItem.agentPrompt ||
        detail.prompt || listItem.prompt ||
        detail.systemPrompt || listItem.systemPrompt ||
        detail.instructions || listItem.instructions ||
        detail.agentInstructions || listItem.agentInstructions ||
        detail.script || listItem.script
      ),
      actions: Array.isArray(detail.actions) ? detail.actions : [],
      maxCallDuration: detail.maxCallDuration,
      channels: readStringArray(listItem.channels || detail.channels)
    };

    return createHash("sha256").update(JSON.stringify(relevantPayload)).digest("hex");
  }

  private buildRawContext(detail: AgentDetail, listItem: AgentListItem): string {
    const SKIP_KEYS = new Set([
      "id", "locationId", "companyId", "createdAt", "updatedAt", "lastUpdatedAt",
      "syncedAt", "status", "agentStatus", "channels", "actions", "name", "agentName"
    ]);

    const merged: Record<string, unknown> = { ...listItem, ...detail };
    const filtered: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(merged)) {
      if (SKIP_KEYS.has(key)) continue;
      if (typeof value === "string" && value.trim().length > 0) {
        filtered[key] = value.trim();
      } else if (typeof value === "number" || typeof value === "boolean") {
        filtered[key] = value;
      }
    }

    if (Object.keys(filtered).length === 0) return "";
    return JSON.stringify(filtered, null, 2);
  }

  private buildPrompt(
    detail: AgentDetail,
    listItem: AgentListItem
  ): string {
    const agentName =
      readString(detail.agentName || listItem.agentName || detail.name || listItem.name) ||
      "Untitled Agent";
    const goal = readString(detail.goal || listItem.goal || detail.description || listItem.description);
    const agentPrompt = readString(
      detail.agentPrompt || listItem.agentPrompt ||
      detail.prompt || listItem.prompt ||
      detail.systemPrompt || listItem.systemPrompt ||
      detail.instructions || listItem.instructions ||
      detail.agentInstructions || listItem.agentInstructions ||
      detail.script || listItem.script
    );
    const welcomeMessage = readString(
      detail.welcomeMessage || listItem.welcomeMessage ||
      detail.firstMessage || listItem.firstMessage ||
      detail.openingMessage || listItem.openingMessage ||
      detail.greeting || listItem.greeting
    );
    const channels = readStringArray(listItem.channels || detail.channels);
    const maxCallDuration =
      typeof detail.maxCallDuration === "number" ? detail.maxCallDuration : null;
    const actions = (
      Array.isArray(detail.actions) ? (detail.actions as Array<Record<string, unknown>>) : []
    ).map((a) => ({
      name: readString(a.name),
      description: readString(a.description)
    }));

    const metadata = {
      agentName,
      goal,
      agentPrompt,
      welcomeMessage,
      channels,
      maxCallDurationSeconds: maxCallDuration,
      configuredActions: actions
    };

    const rawContext = this.buildRawContext(detail, listItem);
    const rawContextSection = rawContext
      ? `\nAdditional raw agent configuration fields (use these to extract any missing context):\n${rawContext}\n`
      : "";

    return `
You are analyzing a Voice AI agent configuration to derive two things:
1. A structured understanding of this agent's goal and workflow (derivedProfile)
2. A flat list of plain-English KPIs — simple, specific statements of what a good call should do

Agent metadata:
${JSON.stringify(metadata, null, 2)}
${rawContextSection}
Return valid JSON only with this exact shape:
{
  "goal": "primary business goal as a single sentence",
  "derivedProfile": {
    "primaryGoal": "string",
    "secondaryGoals": ["string"],
    "workflowStages": [
      { "id": "snake_case_id", "label": "Stage Label", "description": "what happens in this stage" }
    ],
    "requiredInformation": ["field the agent must collect"],
    "handoffActions": ["action name"],
    "successOutcome": "what a fully successful call looks like"
  },
  "kpis": [
    {
      "id": "snake_case_id",
      "kpi": "Plain English statement of what a good call should do or avoid"
    }
  ]
}

Rules for writing KPIs:
- Write 4 to 6 KPIs in plain English. No categories, no weights, no jargon.
- Each KPI should be a clear, specific, testable statement that an LLM can check against a transcript.
- Focus on the most critical steps only — the 4-6 things that matter most for call success.
- If the agentPrompt or any raw config field contains a script, step-by-step instructions, or specific rules, derive KPIs directly from those — reference the exact steps, required fields, and conditional behaviors described.
- If the agent must collect specific data fields (e.g., first name, last name, email, phone), name those exact fields in the KPI.
- If the script has conditional branches (return callers, price concerns, urgency), create an "if X then Y" KPI for each important branch.
- If the script has hard rules (never do X, always do Y before Z), create "never" or "always" KPIs that mirror those rules exactly.
- Include at least 1 "if X then Y" KPI for a likely caller signal (hesitation, urgency, pricing concern).
- Include at least 1 "never do X" KPI for a critical compliance rule.
- Example good KPIs:
  "Verify the caller's first name, last name, email, and phone number before discussing any service topics"
  "Offer to book an appointment and confirm the date, time, and topics before ending the call"
  "Never discuss service topics or answer questions before completing caller identity verification"
  "If the caller is a returning customer, greet them by first name before continuing"
  "If caller expresses price concerns, acknowledge and explain the value before moving on"
  "If caller asks about pricing, acknowledge the concern and explain the value or offer a free inspection"
- Be specific to this agent's actual script and rules — do not generate generic boilerplate.
`.trim();
  }

  private async deriveWithLlm(
    detail: AgentDetail,
    listItem: AgentListItem
  ): Promise<GeneratedAgentKpiResult> {
    const agentName = readString(detail.agentName || listItem.agentName || detail.name || listItem.name) || "Untitled Agent";

    logger.info("AgentKpiDerivationService", `→ POST ${env.openaiApiBaseUrl}/responses`, {
      agentName,
      agentId: detail.id,
      model: env.openaiModel
    });

    const response = await fetch(`${env.openaiApiBaseUrl}/responses`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.openaiApiKey}`
      },
      body: JSON.stringify({
        model: env.openaiModel,
        input: this.buildPrompt(detail, listItem)
      })
    });

    logger.debug("AgentKpiDerivationService", `← ${response.status} ${response.statusText}`, { agentId: detail.id });

    if (!response.ok) {
      const body = await response.text();
      logger.error("AgentKpiDerivationService", "KPI derivation LLM request failed", {
        status: response.status,
        body,
        agentId: detail.id
      });
      throw new HttpError(502, `KPI derivation LLM request failed: ${response.status} ${body}`);
    }

    const envelope = (await response.json()) as OpenAIResponseEnvelope;
    const text = extractResponseText(envelope);

    logger.info("AgentKpiDerivationService", "KPI derivation LLM response received", {
      agentId: detail.id,
      textLength: text.length
    });

    const parsed = safeJsonParse<{
      goal?: string;
      derivedProfile?: Partial<DerivedAgentProfile>;
      kpis?: unknown;
    }>(text);

    if (!parsed?.goal || !parsed.derivedProfile) {
      logger.error("AgentKpiDerivationService", "KPI derivation LLM returned an unparseable or incomplete response", {
        agentId: detail.id,
        receivedText: text
      });
      throw new HttpError(502, "KPI derivation LLM returned an unparseable or incomplete response");
    }

    const kpis = this.normalizeKpis(parsed.kpis);
    if (kpis.length === 0) {
      logger.error("AgentKpiDerivationService", "KPI derivation LLM returned no valid KPIs", {
        agentId: detail.id,
        parsedKpis: parsed.kpis
      });
      throw new HttpError(502, "KPI derivation LLM returned no valid KPIs");
    }

    return {
      goal: parsed.goal,
      derivedProfile: {
        primaryGoal: readString(parsed.derivedProfile.primaryGoal) || parsed.goal,
        secondaryGoals: readStringArray(parsed.derivedProfile.secondaryGoals),
        workflowStages: Array.isArray(parsed.derivedProfile.workflowStages)
          ? parsed.derivedProfile.workflowStages.map((stage, index) => {
            const record = stage as unknown as Record<string, unknown>;
            return {
              id: readString(record.id) || `stage_${index + 1}`,
              label: readString(record.label) || `Stage ${index + 1}`,
              description: readString(record.description)
            };
          })
          : [],
        requiredInformation: readStringArray(parsed.derivedProfile.requiredInformation),
        handoffActions: readStringArray(parsed.derivedProfile.handoffActions),
        successOutcome: readString(parsed.derivedProfile.successOutcome)
      },
      kpis,
      source: "llm"
    };
  }

  private normalizeKpis(raw: unknown): AgentKpiItem[] {
    if (!Array.isArray(raw)) return [];

    return raw
      .map((item, index) => {
        const record = item as Record<string, unknown>;
        const kpiText = readString(record.kpi);
        if (!kpiText) return null;

        const id = readString(record.id) || toSnakeCase(kpiText) || `kpi_${index + 1}`;
        return { id, kpi: kpiText };
      })
      .filter((item): item is AgentKpiItem => item !== null);
  }

  async deriveAgentKpis(
    detail: AgentDetail,
    listItem: AgentListItem,
    existingAgent?: StoredAgent | null,
    existingKpis?: AgentKpiItem[]
  ): Promise<{
    goal: string;
    derivedProfile: DerivedAgentProfile;
    kpis: AgentKpiItem[];
    kpiGeneratedAt: string;
    kpiGenerationSource: "llm" | "fallback";
    metadataFingerprint: string;
  }> {
    const metadataFingerprint = this.buildMetadataFingerprint(detail, listItem);

    // Skip LLM call if agent metadata hasn't changed and we already have KPIs
    if (
      existingAgent &&
      existingAgent.metadataFingerprint === metadataFingerprint &&
      existingKpis && existingKpis.length > 0
    ) {
      return {
        goal: existingAgent.goal,
        derivedProfile: existingAgent.derivedProfile,
        kpis: existingKpis,
        kpiGeneratedAt: existingAgent.kpiGeneratedAt,
        kpiGenerationSource: existingAgent.kpiGenerationSource,
        metadataFingerprint
      };
    }

    const derived = await this.deriveWithLlm(detail, listItem);

    return {
      goal: derived.goal,
      derivedProfile: derived.derivedProfile,
      kpis: derived.kpis,
      kpiGeneratedAt: new Date().toISOString(),
      kpiGenerationSource: "llm",
      metadataFingerprint
    };
  }
}

export const agentKpiDerivationService = new AgentKpiDerivationService();
