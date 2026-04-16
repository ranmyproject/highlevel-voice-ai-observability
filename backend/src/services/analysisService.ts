import type {
  AgentAnalysis,
  AgentIssue,
  DashboardResponse,
  IssueDefinition,
  IssueId,
  Recommendation,
  StoredAgent,
  Transcript,
  TranscriptInput,
  TranscriptIssueSummary,
  UseAction
} from "../types.js";

const ISSUE_LIBRARY: Record<IssueId, IssueDefinition> = {
  long_call: {
    label: "Long call duration",
    severity: "medium",
    recommendation:
      "Tighten discovery prompts and add an explicit branch for pricing questions to reduce rambling exchanges."
  },
  pricing_confusion: {
    label: "Pricing confusion",
    severity: "high",
    recommendation:
      "Add clearer rate explanation guidance and a fallback action to escalate nuanced pricing questions."
  },
  missed_booking: {
    label: "Missed booking opportunity",
    severity: "high",
    recommendation:
      "Inject a stronger close sequence with two concrete next-step options before ending the call."
  },
  insurance_gap: {
    label: "Insurance knowledge gap",
    severity: "high",
    recommendation:
      "Expand the script with insurance reassurance language and a handoff workflow for verification."
  },
  missed_objection_handling: {
    label: "Weak objection handling",
    severity: "medium",
    recommendation:
      "Train the prompt with objection-specific rebuttals and examples for hesitant callers."
  },
  urgent_case: {
    label: "Urgent escalation triggered",
    severity: "info",
    recommendation:
      "Keep the escalation branch visible in QA review and monitor whether dispatch SLAs are met."
  },
  missing_required_data: {
    label: "Required field missed",
    severity: "high",
    recommendation:
      "Add required slot validation before call completion so the agent cannot close without key data."
  },
  slow_triage: {
    label: "Slow emergency triage",
    severity: "medium",
    recommendation:
      "Move emergency qualification questions earlier and shorten non-essential prompts in after-hours flows."
  }
};

const average = (values: number[]): number =>
  values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;

const issueSummaryFromTranscript = (transcript: Transcript): TranscriptIssueSummary[] =>
  transcript.issues.map((issueId) => ({
    id: issueId,
    ...ISSUE_LIBRARY[issueId]
  }));

export function analyzeAgent(
  agent: StoredAgent,
  agentTranscripts: Transcript[]
): AgentAnalysis {
  const totalCalls = agentTranscripts.length;
  const bookings = agentTranscripts.filter((item) => item.booked).length;
  const escalations = agentTranscripts.filter((item) => item.interventionRequired).length;
  const averageHandleTimeSec = Math.round(
    average(agentTranscripts.map((item) => item.durationSec))
  );
  const bookingRate = totalCalls ? bookings / totalCalls : 0;
  const complianceRate =
    totalCalls === 0
      ? 1
      : agentTranscripts.filter((item) => !item.issues.includes("missing_required_data")).length /
      totalCalls;

  const issues: AgentIssue[] = agentTranscripts.flatMap((item) =>
    item.issues.map((issueId) => ({
      transcriptId: item.id,
      timestamp: item.timestamp,
      caller: item.caller,
      id: issueId,
      ...ISSUE_LIBRARY[issueId]
    }))
  );

  const issueCounts = issues.reduce<Record<IssueId, number | undefined>>((accumulator, issue) => {
    accumulator[issue.id] = (accumulator[issue.id] || 0) + 1;
    return accumulator;
  }, {} as Record<IssueId, number | undefined>);

  const recommendations: Recommendation[] = Object.entries(issueCounts)
    .filter((entry): entry is [IssueId, number] => typeof entry[1] === "number")
    .sort(([, aCount], [, bCount]) => bCount - aCount)
    .slice(0, 3)
    .map(([issueId, count]) => ({
      issueId,
      count,
      label: ISSUE_LIBRARY[issueId].label,
      recommendation: ISSUE_LIBRARY[issueId].recommendation
    }));

  const useActions: UseAction[] = agentTranscripts
    .filter((item) => item.actionItems.length > 0)
    .flatMap((item) =>
      item.actionItems.map((action) => ({
        transcriptId: item.id,
        caller: item.caller,
        timestamp: item.timestamp,
        action
      }))
    );

  // Note: We're calculating deltas based on some sensible defaults or provided targets
  // In the real StoredAgent, these targets come from kpiBlueprint or similar.
  const bookingRateTarget = 0.2; // Default 20%
  const complianceTarget = 0.9; // Default 90%
  const avgHandleTimeTargetSec = 300; // Default 5 mins

  return {
    agent: {
      id: agent.id,
      name: agent.name,
      channel: agent.channels.join(", "),
      goal: agent.goal,
      scriptFocus: agent.derivedProfile.secondaryGoals,
      kpis: {
        bookingRateTarget,
        complianceTarget,
        avgHandleTimeTargetSec
      }
    },
    summary: {
      totalCalls,
      bookings,
      escalations,
      bookingRate,
      complianceRate,
      averageHandleTimeSec,
      bookingRateDelta: bookingRate - bookingRateTarget,
      complianceDelta: complianceRate - complianceTarget,
      handleTimeDeltaSec: averageHandleTimeSec - avgHandleTimeTargetSec
    },
    issues,
    recommendations,
    useActions,
    transcripts: agentTranscripts.map((item) => ({
      ...item,
      analyzedIssues: issueSummaryFromTranscript(item)
    }))
  };
}

export function buildDashboard(
  agents: StoredAgent[],
  transcripts: Transcript[]
): DashboardResponse {
  const agentAnalyses = agents.map((agent) =>
    analyzeAgent(
      agent,
      transcripts.filter((transcript) => transcript.agentId === agent.id)
    )
  );

  const totals = agentAnalyses.reduce(
    (accumulator, analysis) => {
      accumulator.totalCalls += analysis.summary.totalCalls;
      accumulator.bookings += analysis.summary.bookings;
      accumulator.escalations += analysis.summary.escalations;
      accumulator.totalIssueCount += analysis.issues.length;
      return accumulator;
    },
    { totalCalls: 0, bookings: 0, escalations: 0, totalIssueCount: 0 }
  );

  return {
    generatedAt: new Date().toISOString(),
    overview: {
      ...totals,
      bookingRate: totals.totalCalls ? totals.bookings / totals.totalCalls : 0
    },
    agentSummaries: agentAnalyses.map((analysis) => ({
      id: analysis.agent.id,
      name: analysis.agent.name,
      goal: analysis.agent.goal,
      channel: analysis.agent.channel,
      summary: analysis.summary,
      topIssue: analysis.recommendations[0]?.label || "No critical issues detected"
    })),
    issuesFeed: agentAnalyses
      .flatMap((analysis) =>
        analysis.issues.map((issue) => ({
          agentId: analysis.agent.id,
          agentName: analysis.agent.name,
          ...issue
        }))
      )
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 10)
  };
}

export function analyzeTranscript(
  agent: StoredAgent,
  transcriptInput: TranscriptInput
): Transcript {
  const issues: IssueId[] = [];

  // In real agent, handle time target would be from the profile/kpi
  const avgHandleTimeTargetSec = 300;

  if (transcriptInput.durationSec > avgHandleTimeTargetSec) {
    issues.push("long_call");
  }

  const transcriptLower = transcriptInput.transcript.toLowerCase();
  if (transcriptLower.includes("price") || transcriptLower.includes("rate")) {
    issues.push("pricing_confusion");
  }
  if (transcriptLower.includes("insurance")) {
    issues.push("insurance_gap");
  }
  if (transcriptLower.includes("address") === false && agent.id === "hvac-afterhours") {
    issues.push("missing_required_data");
  }
  if (transcriptLower.includes("call me later") || transcriptLower.includes("not sure")) {
    issues.push("missed_objection_handling");
  }
  if (transcriptInput.booked === false) {
    issues.push("missed_booking");
  }

  const actionItems: string[] = [];
  if (issues.includes("missing_required_data")) {
    actionItems.push("Human QA review for missing required data");
  }
  if (issues.includes("pricing_confusion") || issues.includes("insurance_gap")) {
    actionItems.push("Update prompt guidance and re-review this call");
  }

  return {
    ...transcriptInput,
    issues,
    interventionRequired: transcriptInput.interventionRequired || actionItems.length > 0,
    actionItems
  };
}

