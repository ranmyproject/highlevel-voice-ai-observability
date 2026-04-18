import { env } from "../config/env.js";
import { HttpError } from "../errors/HttpError.js";
import type {
  AgentAggregates,
  AgentRecommendation,
  StoredAgent
} from "../types.js";

interface OpenAIResponseEnvelope {
  output_text?: string;
  output?: Array<{ content?: Array<{ text?: string }> }>;
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

export function readAgentScript(agent: StoredAgent): string {
  const detail = agent.detailPayload as Record<string, unknown>;
  const candidates = [
    "agentPrompt", "prompt", "systemPrompt", "instructions",
    "agentInstructions", "script"
  ];
  for (const key of candidates) {
    const val = detail[key];
    if (typeof val === "string" && val.trim().length > 0) return val.trim();
  }
  return "";
}

class AgentSynthesisService {
  private buildPrompt(agent: StoredAgent, aggregates: AgentAggregates): string {
    const kpiSummary = aggregates.kpiAggregates
      .map((k) => {
        const pct = (n: number): string =>
          k.total > 0 ? `${Math.round((n / k.total) * 100)}%` : "0%";
        return `- "${k.kpi}": achieved ${pct(k.achieved)}, deviated ${pct(k.deviated)}, failed ${pct(k.failed)}, missed ${pct(k.missed)} (${k.total} calls)`;
      })
      .join("\n");

    const agentScript = readAgentScript(agent);
    const scriptSection = agentScript
      ? `\nCurrent Agent Script / Instructions:\n"""\n${agentScript}\n"""\n`
      : "";

    return `
You are generating improvement recommendations for a Voice AI agent. The agent runs on a third-party LLM provider — you CANNOT suggest retraining or fine-tuning the model. Every fix must be achievable by editing the agent's script/prompt, changing an operational process, or adding a QA monitoring rule.

Agent: ${agent.name}
Primary Goal: ${agent.derivedProfile.primaryGoal}
Success Outcome: ${agent.derivedProfile.successOutcome}
Workflow Stages: ${agent.derivedProfile.workflowStages.map((s) => s.label).join(" → ")}
${scriptSection}
Performance Summary (${aggregates.evaluatedCalls} evaluated calls):
- Overall Score: ${aggregates.overallScore}/100
- Goal Achievement Rate: ${aggregates.goalAchievementRate}%

KPI Results:
${kpiSummary || "No KPI data available."}

Most Frequent Failures: ${aggregates.topFailures.map((f) => `"${f}"`).join(", ") || "None."}
Most Frequent Deviations: ${aggregates.topDeviations.map((f) => `"${f}"`).join(", ") || "None."}
Most Frequently Missed: ${aggregates.topMissed.map((f) => `"${f}"`).join(", ") || "None."}

Generate 3–5 concrete, actionable recommendations. Each must:
1. Target a specific KPI that is failing, deviating, or being missed
2. Tell the user exactly what to change — if it is a prompt fix, quote or paraphrase the specific instruction to add or rewrite in the agent's script
3. Explain why the current behavior is happening based on the script (if available) and performance data

Return valid JSON only:
[
  {
    "id": "unique_snake_case_id",
    "title": "Short title (max 8 words)",
    "description": "Specific fix: what to change, where, and why. For prompt fixes, include the exact instruction or wording to add/replace.",
    "priority": "high | medium | low",
    "owner": "prompt | operations | qa"
  }
]

Owner definitions (no other values allowed):
- "prompt" = edit the agent's script or system prompt in HighLevel — use this for any change to what the agent says or does
- "operations" = change a business process or workflow that exists outside the agent config (e.g., calendar setup, CRM field, call routing)
- "qa" = add a monitoring or flagging rule to catch this issue in future calls without touching the agent

Priority rules:
- "high" = KPI with 0% achievement OR directly blocks the call goal
- "medium" = KPI failing >50% of calls but does not block goal completion
- "low" = KPI missing occasionally, minor impact

Never suggest retraining, fine-tuning, or adding training examples.
`.trim();
  }

  async synthesize(
    agent: StoredAgent,
    aggregates: AgentAggregates
  ): Promise<AgentRecommendation[]> {
    const response = await fetch(`${env.openaiApiBaseUrl}/responses`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.openaiApiKey}`
      },
      body: JSON.stringify({
        model: env.openaiModel,
        input: this.buildPrompt(agent, aggregates)
      })
    });

    if (!response.ok) {
      const body = await response.text();
      throw new HttpError(
        502,
        `Agent synthesis LLM request failed: ${response.status} ${body}`
      );
    }

    const rawEnvelope = (await response.json()) as OpenAIResponseEnvelope;
    const outputText = extractResponseText(rawEnvelope);

    const parsed = safeJsonParse<
      Array<{
        id?: string;
        title?: string;
        description?: string;
        priority?: string;
        owner?: string;
      }>
    >(outputText);

    if (!parsed || !Array.isArray(parsed)) {
      throw new HttpError(502, "Agent synthesis LLM returned an unparseable response");
    }

    const now = new Date().toISOString();

    return parsed.map((item, index) => ({
      id: item.id || `rec_${index + 1}`,
      title: item.title || "Improvement Recommendation",
      description: item.description || "No description returned.",
      priority:
        item.priority === "high" || item.priority === "medium" || item.priority === "low"
          ? item.priority
          : "medium",
      owner:
        item.owner === "prompt" ||
        item.owner === "operations" ||
        item.owner === "qa"
          ? item.owner
          : "prompt",
      basedOnCallCount: aggregates.evaluatedCalls,
      generatedAt: now
    }));
  }
  private async requestPromptPatch(
    currentPrompt: string,
    recommendationContext: string
  ): Promise<{ promptFieldKey: string; updatedPrompt: string }> {
    const systemMessage = `You are an expert Voice AI prompt engineer. Your task is to improve an existing agent system prompt by incorporating recommendation(s). You must:
1. Return the FULL updated prompt — not a diff, not just the added section.
2. Only add or modify what is directly necessary to address the recommendation(s).
3. Preserve all original structure, tone, and instructions.
4. Resolve conflicts sensibly if recommendations overlap.
5. Do NOT add meta-commentary, only return the prompt text.`;

    const userMessage = `Current Agent Prompt:
"""
${currentPrompt}
"""

Recommendation(s) to apply:
${recommendationContext}

Return a JSON object with exactly these keys:
{
  "promptFieldKey": "agentPrompt",
  "updatedPrompt": "<the full, updated prompt text>"
}`;

    const response = await fetch(`${env.openaiApiBaseUrl}/responses`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.openaiApiKey}`
      },
      body: JSON.stringify({
        model: env.openaiModel,
        input: `${systemMessage}\n\n${userMessage}`
      })
    });

    if (!response.ok) {
      const body = await response.text();
      throw new HttpError(502, `Prompt patch LLM request failed: ${response.status} ${body}`);
    }

    const rawEnvelope = (await response.json()) as OpenAIResponseEnvelope;
    const outputText = extractResponseText(rawEnvelope);
    const parsed = safeJsonParse<{ promptFieldKey?: string; updatedPrompt?: string }>(outputText);

    if (!parsed || typeof parsed.updatedPrompt !== "string" || parsed.updatedPrompt.trim().length === 0) {
      throw new HttpError(502, `Prompt patch LLM returned an unparseable or empty response: ${outputText.slice(0, 200)}`);
    }

    return {
      promptFieldKey: parsed.promptFieldKey || "agentPrompt",
      updatedPrompt: parsed.updatedPrompt.trim()
    };
  }

  async generatePromptPatch(
    agent: StoredAgent,
    recommendation: AgentRecommendation
  ): Promise<{ promptFieldKey: string; updatedPrompt: string }> {
    const currentPrompt = readAgentScript(agent);

    if (!currentPrompt) {
      throw new HttpError(
        400,
        "Cannot generate a prompt patch: no existing agent prompt found in the stored agent payload."
      );
    }

    const recommendationContext = `1. Title: ${recommendation.title}\nDescription: ${recommendation.description}`;
    return this.requestPromptPatch(currentPrompt, recommendationContext);
  }

  async generatePromptPatchForRecommendations(
    agent: StoredAgent,
    recommendations: AgentRecommendation[]
  ): Promise<{ promptFieldKey: string; updatedPrompt: string }> {
    const currentPrompt = readAgentScript(agent);

    if (!currentPrompt) {
      throw new HttpError(
        400,
        "Cannot generate a prompt patch: no existing agent prompt found in the stored agent payload."
      );
    }

    if (!Array.isArray(recommendations) || recommendations.length === 0) {
      throw new HttpError(400, "At least one recommendation is required to generate a prompt patch.");
    }

    const recommendationContext = recommendations
      .map(
        (recommendation, index) =>
          `${index + 1}. Title: ${recommendation.title}\nDescription: ${recommendation.description}`
      )
      .join("\n\n");

    return this.requestPromptPatch(currentPrompt, recommendationContext);
  }
}

export const agentSynthesisService = new AgentSynthesisService();
