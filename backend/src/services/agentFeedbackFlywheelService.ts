import { randomUUID } from "node:crypto";

import type {
  AgentAggregates,
  AgentFeedbackCycle,
  AgentRecommendation,
  StoredAgent
} from "../types.js";

function deriveHealthStatus(aggregates?: AgentAggregates): AgentFeedbackCycle["healthStatus"] {
  if (!aggregates || aggregates.evaluatedCalls === 0) {
    return "insufficient_data";
  }

  if (aggregates.overallScore >= 80) {
    return "healthy";
  }

  if (aggregates.overallScore >= 60) {
    return "needs_attention";
  }

  return "at_risk";
}

class AgentFeedbackFlywheelService {
  buildCycle(
    agent: StoredAgent,
    aggregates: AgentAggregates,
    recommendations: AgentRecommendation[]
  ): AgentFeedbackCycle {
    const weakestKpis = [...aggregates.kpiAggregates]
      .map((kpi) => ({
        kpiId: kpi.kpiId,
        kpi: kpi.kpi,
        issueRate: kpi.total > 0
          ? Math.round(((kpi.deviated + kpi.failed + kpi.missed) / kpi.total) * 100)
          : 0
      }))
      .sort((left, right) => right.issueRate - left.issueRate)
      .slice(0, 4);

    const summary =
      aggregates.evaluatedCalls === 0
        ? "Calls are synced, but there is not enough analyzed transcript data yet to close the feedback loop."
        : `${agent.name} is ${deriveHealthStatus(aggregates).replace(/_/g, " ")} with an overall score of ${aggregates.overallScore}/100 across ${aggregates.evaluatedCalls} analyzed calls.`;

    return {
      id: randomUUID(),
      agentId: agent.id,
      locationId: agent.locationId,
      generatedAt: new Date().toISOString(),
      summary,
      healthStatus: deriveHealthStatus(aggregates),
      weakestKpis,
      recommendations,
      nextActions: recommendations.map((recommendation) => recommendation.title)
    };
  }
}

export const agentFeedbackFlywheelService = new AgentFeedbackFlywheelService();
