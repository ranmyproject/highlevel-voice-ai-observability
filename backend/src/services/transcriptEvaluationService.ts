import { createHash } from "node:crypto";

import { env } from "../config/env.js";
import { HttpError } from "../errors/HttpError.js";
import type {
  AgentKpiItem,
  CallEndType,
  KpiStatus,
  StoredVoiceCall,
  StoredAgent,
  TranscriptEvaluation,
  TranscriptKpiResult
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

function statusToScore(status: KpiStatus): number {
  if (status === "achieved") return 100;
  if (status === "deviated") return 50;
  return 0; // failed, missed → 0
}

// Average of status scores across evaluable KPIs (excludes skipped + unreachable)
function computeOverallScore(kpiResults: TranscriptKpiResult[]): number {
  const active = kpiResults.filter(
    (r) => r.status !== "skipped" && r.status !== "unreachable"
  );
  if (active.length === 0) return 0;
  const sum = active.reduce((s, r) => s + statusToScore(r.status), 0);
  return Math.round(sum / active.length);
}

export function buildTranscriptFingerprint(call: StoredVoiceCall): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        transcript: call.transcript,
        summary: call.summary,
        durationSec: call.durationSec,
        extractedData: call.extractedData,
        status: call.status
      })
    )
    .digest("hex");
}

class TranscriptEvaluationService {
  private buildPrompt(call: StoredVoiceCall, agent: StoredAgent, kpis: AgentKpiItem[]): string {
    const kpiList = kpis.map((k, i) => `${i + 1}. [${k.id}] ${k.kpi}`).join("\n");

    return `
You are evaluating a Voice AI call against the agent's KPIs.

Agent: ${agent.name}
Goal: ${agent.derivedProfile.primaryGoal}
Success Outcome: ${agent.derivedProfile.successOutcome}

KPIs to check (check EVERY one):
${kpiList}

Call Duration: ${call.durationSec}s
Call Status: ${call.status}
Call Summary: ${call.summary || "None"}
Extracted Data: ${JSON.stringify(call.extractedData)}
Transcript:
${call.transcript || "No transcript available"}

STEP 0 — Classify how the call ended before evaluating any KPI.

callEndType options:
- "completed": the call reached a natural end with closing pleasantries or a confirmed next step
- "cut_short": the call ended abruptly mid-conversation (network drop, technical issue — no frustration signals from the caller)
- "caller_hangup": the caller deliberately ended the call early, potentially due to frustration or disinterest
- "wrong_number": the call was under 30 seconds or had no meaningful conversation

For "cut_short" or "caller_hangup": identify the last meaningful exchange — any KPI that had no opportunity to be addressed after that point must be marked "unreachable".

Return valid JSON only:
{
  "callEndType": "completed | cut_short | caller_hangup | wrong_number",
  "goalAchieved": true,
  "summary": "1-2 sentence summary of how the call went",
  "topFix": "The single most important improvement this agent needs based on this call, or null if the call went well",
  "promptSnippet": "Ready-to-use text to add to the agent's prompt that would fix the topFix issue, or null",
  "kpiResults": [
    {
      "kpiId": "exact_id_from_list",
      "kpi": "exact KPI text from list",
      "status": "achieved | deviated | failed | missed | skipped | unreachable",
      "evidence": "verbatim quote from the transcript that drove this classification",
      "fix": "specific, one-sentence prompt fix for this KPI, or null if achieved",
      "humanFollowup": false
    }
  ]
}

Status rules:
- achieved: the KPI was fully and correctly satisfied
- deviated: the KPI was partially satisfied or done incorrectly (deviation)
- failed: the KPI was not done at all, or a "never do X" rule was broken (failure or violation)
- missed: a signal appeared in the transcript that should have triggered action, but the agent ignored it
- skipped: no transcript available or KPI is entirely inapplicable for structural reasons unrelated to call length
- unreachable: the call ended (cut_short or caller_hangup) before the conversation reached the point where this KPI could have been addressed — NEVER penalize the agent for these

Rules:
- Check EVERY KPI — do not skip any.
- For "unreachable" KPIs: set evidence to explain where the call ended and why this KPI was not reachable.
- For all other statuses: populate "evidence" with the actual verbatim quote from the transcript.
- Only generate a "fix" for deviated, failed, or missed statuses. Set fix to null for achieved, skipped, and unreachable.
- Set humanFollowup to true if this KPI result means a human must personally follow up with the caller (e.g. an unresolved safety issue, an unanswered urgent request, or a commitment made that requires manual action). Otherwise false.
- "topFix" should be null if all evaluable KPIs were achieved. Do not suggest fixes for unreachable KPIs.
- "promptSnippet" should be a concrete sentence or two to add verbatim to the agent's system prompt.
- IMPORTANT: unreachable KPIs are excluded from scoring — never count them as failures.
`.trim();
  }

  async evaluate(
    call: StoredVoiceCall,
    agent: StoredAgent,
    kpis: AgentKpiItem[]
  ): Promise<TranscriptEvaluation> {
    const response = await fetch(`${env.openaiApiBaseUrl}/responses`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.openaiApiKey}`
      },
      body: JSON.stringify({
        model: env.openaiModel,
        input: this.buildPrompt(call, agent, kpis)
      })
    });

    if (!response.ok) {
      const body = await response.text();
      throw new HttpError(
        502,
        `Transcript evaluation LLM request failed: ${response.status} ${body}`
      );
    }

    const rawEnvelope = (await response.json()) as OpenAIResponseEnvelope;
    const outputText = extractResponseText(rawEnvelope);

    const parsed = safeJsonParse<{
      callEndType?: string;
      goalAchieved?: boolean;
      summary?: string;
      topFix?: string | null;
      promptSnippet?: string | null;
      kpiResults?: Array<{
        kpiId?: string;
        kpi?: string;
        status?: string;
        evidence?: string;
        fix?: string | null;
        humanFollowup?: boolean;
      }>;
    }>(outputText);

    if (!parsed) {
      throw new HttpError(502, "Transcript evaluation LLM returned an unparseable response");
    }

    const validCallEndTypes: CallEndType[] = ["completed", "cut_short", "caller_hangup", "wrong_number"];
    const validStatuses: KpiStatus[] = ["achieved", "deviated", "failed", "missed", "skipped", "unreachable"];

    const kpiResults: TranscriptKpiResult[] = (parsed.kpiResults || []).map((item) => {
      const status: KpiStatus = validStatuses.includes(item.status as KpiStatus)
        ? (item.status as KpiStatus)
        : "failed";

      return {
        kpiId: item.kpiId || "unknown",
        kpi: item.kpi || item.kpiId || "Unknown KPI",
        status,
        evidence: typeof item.evidence === "string" && item.evidence.length > 0
          ? item.evidence
          : "No evidence provided.",
        fix: typeof item.fix === "string" && item.fix.length > 0 ? item.fix : null,
        humanFollowup: Boolean(item.humanFollowup)
      };
    });

    const callEndType: CallEndType = validCallEndTypes.includes(parsed.callEndType as CallEndType)
      ? (parsed.callEndType as CallEndType)
      : "completed";

    return {
      callId: call.id,
      locationId: call.locationId,
      agentId: call.agentId,
      evaluatedAt: new Date().toISOString(),
      model: env.openaiModel,
      transcriptFingerprint: buildTranscriptFingerprint(call),
      agentMetadataFingerprint: agent.metadataFingerprint,
      goalAchieved: Boolean(parsed.goalAchieved),
      overallScore: computeOverallScore(kpiResults),
      summary: parsed.summary || "No summary returned.",
      callEndType,
      topFix: typeof parsed.topFix === "string" && parsed.topFix.length > 0 ? parsed.topFix : null,
      promptSnippet: typeof parsed.promptSnippet === "string" && parsed.promptSnippet.length > 0
        ? parsed.promptSnippet
        : null,
      kpiResults
    };
  }
}

export const transcriptEvaluationService = new TranscriptEvaluationService();
