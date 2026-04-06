import type {
  CallMonitorDecision,
  CallMonitorSignal,
  StoredAgent,
  StoredVoiceCall
} from "../types.js";

function normalizeText(...values: Array<string | undefined>): string {
  return values
    .filter((value): value is string => typeof value === "string" && value.length > 0)
    .join(" ")
    .toLowerCase();
}

function clampUnit(value: number): number {
  return Math.max(0, Math.min(1, Number(value.toFixed(2))));
}

function hasAnyPhrase(text: string, phrases: string[]): string | null {
  for (const phrase of phrases) {
    if (text.includes(phrase)) {
      return phrase;
    }
  }

  return null;
}

function stringifyUnknown(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

function buildExtractedDataText(data: Record<string, unknown>): string {
  return Object.entries(data)
    .flatMap(([key, value]) => [key, stringifyUnknown(value)])
    .join(" ")
    .toLowerCase();
}

function readConfiguredActionNames(agent: StoredAgent): string[] {
  const actions = (agent.detailPayload.actions as Array<Record<string, unknown>> | undefined) || [];

  return actions
    .map((action) =>
      typeof action.name === "string" && action.name.length > 0
        ? action.name
        : typeof action.actionType === "string"
          ? action.actionType
          : ""
    )
    .filter(Boolean);
}

class CallMonitoringService {
  private buildSignals(
    call: StoredVoiceCall,
    agent: StoredAgent
  ): CallMonitorSignal[] {
    const transcriptText = normalizeText(call.transcript);
    const summaryText = normalizeText(call.summary);
    const combinedText = normalizeText(call.transcript, call.summary);
    const extractedDataText = buildExtractedDataText(call.extractedData);
    const expectedActions = [
      ...agent.derivedProfile.handoffActions,
      ...readConfiguredActionNames(agent)
    ].filter(Boolean);

    const requiredRequirements = agent.derivedProfile.requiredInformation.filter(Boolean);
    const signals: CallMonitorSignal[] = [];

    const summarySuccessPhrase = hasAnyPhrase(summaryText, [
      "agreed",
      "scheduled",
      "booked",
      "follow-up",
      "follow up",
      "text sent",
      "next step",
      "impact assessment"
    ]);
    signals.push({
      id: "summary_success",
      label: "Summary indicates success",
      type: "success",
      source: "summary",
      weight: 0.35,
      matched: Boolean(summarySuccessPhrase),
      evidence: summarySuccessPhrase || undefined
    });

    const summaryFailurePhrase = hasAnyPhrase(summaryText, [
      "not interested",
      "declined",
      "hung up",
      "no answer",
      "no outcome",
      "did not agree",
      "rejected"
    ]);
    signals.push({
      id: "summary_failure",
      label: "Summary indicates failure",
      type: "failure",
      source: "summary",
      weight: 0.4,
      matched: Boolean(summaryFailurePhrase),
      evidence: summaryFailurePhrase || undefined
    });

    const transcriptConfirmationPhrase = hasAnyPhrase(transcriptText, [
      "i'll send you a text",
      "does that sound good",
      "we can schedule",
      "let's schedule",
      "i can send you"
    ]);
    signals.push({
      id: "transcript_confirmation",
      label: "Transcript confirms next step",
      type: "success",
      source: "transcript",
      weight: 0.2,
      matched: Boolean(transcriptConfirmationPhrase),
      evidence: transcriptConfirmationPhrase || undefined
    });

    const transcriptFailurePhrase = hasAnyPhrase(transcriptText, [
      "not interested",
      "no thank you",
      "stop calling",
      "goodbye",
      "i'm not sure",
      "maybe later"
    ]);
    signals.push({
      id: "transcript_failure",
      label: "Transcript shows rejection or hesitation",
      type: "failure",
      source: "transcript",
      weight: 0.15,
      matched: Boolean(transcriptFailurePhrase),
      evidence: transcriptFailurePhrase || undefined
    });

    const matchedRequirements = requiredRequirements.filter((requirement) => {
      const normalized = requirement.toLowerCase();
      return combinedText.includes(normalized) || extractedDataText.includes(normalized);
    });
    signals.push({
      id: "required_information",
      label: "Required information captured",
      type: matchedRequirements.length === requiredRequirements.length ? "success" : "uncertainty",
      source: "extracted_data",
      weight: requiredRequirements.length > 0 ? 0.2 : 0,
      matched:
        requiredRequirements.length === 0 ||
        matchedRequirements.length === requiredRequirements.length,
      evidence:
        matchedRequirements.length > 0 ? `Captured: ${matchedRequirements.join(", ")}` : undefined
    });

    const actionEvidence = expectedActions.filter((action) =>
      combinedText.includes(action.toLowerCase())
    );
    signals.push({
      id: "expected_action",
      label: "Expected action or handoff mentioned",
      type: actionEvidence.length > 0 ? "success" : expectedActions.length > 0 ? "uncertainty" : "success",
      source: "action",
      weight: expectedActions.length > 0 ? 0.2 : 0.05,
      matched: expectedActions.length === 0 || actionEvidence.length > 0,
      evidence: actionEvidence.length > 0 ? actionEvidence.join(", ") : undefined
    });

    const durationHealthy = call.durationSec >= 45 && call.durationSec <= 15 * 60;
    const durationTooShort = call.durationSec > 0 && call.durationSec < 20;
    signals.push({
      id: "duration_healthy",
      label: "Call duration is in expected range",
      type: durationHealthy ? "success" : durationTooShort ? "failure" : "uncertainty",
      source: "duration",
      weight: 0.1,
      matched: durationHealthy,
      evidence: `${call.durationSec}s`
    });

    const statusFailure = hasAnyPhrase(call.status.toLowerCase(), [
      "failed",
      "abandoned",
      "missed",
      "no-answer"
    ]);
    signals.push({
      id: "status_failure",
      label: "Call status indicates failure",
      type: "failure",
      source: "status",
      weight: 0.15,
      matched: Boolean(statusFailure),
      evidence: statusFailure || undefined
    });

    return signals.filter((signal) => signal.weight > 0);
  }

  evaluateCall(call: StoredVoiceCall, agent: StoredAgent): CallMonitorDecision {
    const matchedSignals = this.buildSignals(call, agent);
    const successScore = clampUnit(
      matchedSignals
        .filter((signal) => signal.type === "success" && signal.matched)
        .reduce((sum, signal) => sum + signal.weight, 0)
    );
    const failureScore = clampUnit(
      matchedSignals
        .filter((signal) => signal.type === "failure" && signal.matched)
        .reduce((sum, signal) => sum + signal.weight, 0)
    );
    const uncertaintyScore = clampUnit(
      matchedSignals
        .filter((signal) => signal.type === "uncertainty" && !signal.matched)
        .reduce((sum, signal) => sum + signal.weight, 0)
    );

    const conflictPenalty = successScore > 0.2 && failureScore > 0.2 ? 0.2 : 0;
    const confidence = clampUnit(Math.max(successScore, failureScore) - conflictPenalty);

    let objectiveStatus: CallMonitorDecision["objectiveStatus"] = "uncertain";
    let analyzeReason: CallMonitorDecision["analyzeReason"] = "objective_uncertain";
    let shouldAnalyze = true;

    if (successScore >= 0.75 && failureScore < 0.25 && confidence >= 0.7) {
      objectiveStatus = "achieved";
      analyzeReason = "skipped_high_confidence_success";
      shouldAnalyze = false;
    } else if (failureScore >= 0.45 || uncertaintyScore >= 0.3) {
      objectiveStatus = failureScore >= 0.45 ? "failed" : "uncertain";
      analyzeReason = objectiveStatus === "failed" ? "objective_failed" : "objective_uncertain";
      shouldAnalyze = true;
    }

    const missingRequirements = agent.derivedProfile.requiredInformation.filter((requirement) => {
      const requirementLower = requirement.toLowerCase();
      const combinedText = normalizeText(call.transcript, call.summary, buildExtractedDataText(call.extractedData));
      return !combinedText.includes(requirementLower);
    });

    const notes = [
      successScore >= 0.75 ? "Rule gate found strong success evidence." : "",
      failureScore >= 0.45 ? "Rule gate found clear failure signals." : "",
      uncertaintyScore >= 0.3 ? "Rule gate found incomplete or ambiguous evidence." : ""
    ].filter(Boolean);

    return {
      callId: call.id,
      locationId: call.locationId,
      agentId: call.agentId,
      evaluatedAt: new Date().toISOString(),
      objectiveStatus,
      shouldAnalyze,
      analyzeReason,
      successScore,
      failureScore,
      uncertaintyScore,
      confidence,
      matchedSignals,
      expectedActions: [...agent.derivedProfile.handoffActions, ...readConfiguredActionNames(agent)],
      missingRequirements,
      notes
    };
  }
}

export const callMonitoringService = new CallMonitoringService();
