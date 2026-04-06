// ─── KPI Blueprint ────────────────────────────────────────────────────────────
// Derived from the agent's goal/script via LLM. Stored on the agent document.

export type KpiCategory = "outcome" | "quality" | "workflow" | "compliance" | "efficiency";
export type KpiMetricType = "boolean" | "score" | "duration" | "rate";
export type KpiSource = "goal" | "workflow" | "compliance" | "efficiency";
export type KpiEvaluationMethod = "llm" | "metadata" | "duration_rule" | "event_check";

export interface AgentKpiBlueprint {
  id: string;
  label: string;
  description: string;
  successSignal: string;
  category: KpiCategory;
  metricType: KpiMetricType;
  weight: number; // 1–5, used for weighted scoring
  source: KpiSource;
  evaluationMethod: KpiEvaluationMethod;
}

// ─── Derived Profile ──────────────────────────────────────────────────────────
// LLM-extracted structured understanding of the agent's purpose and workflow.

export interface AgentWorkflowStage {
  id: string;
  label: string;
  description: string;
}

export interface DerivedAgentProfile {
  primaryGoal: string;
  secondaryGoals: string[];
  workflowStages: AgentWorkflowStage[];
  requiredInformation: string[];
  handoffActions: string[];
  successOutcome: string;
}

// ─── Aggregates ───────────────────────────────────────────────────────────────
// Incrementally updated on every new evaluated call. Never recomputed from scratch.

export interface KpiPassRateStat {
  kpiId: string;
  label: string;
  passed: number; // calls scoring >= 70
  total: number;  // total evaluated calls with this KPI scored
}

export interface FailureFrequencyStat {
  text: string;  // failure label text
  count: number; // how many calls had this failure
}

export interface AgentAggregates {
  totalCalls: number;
  evaluatedCalls: number;
  averageScore: number | null;        // null until at least one call is evaluated
  goalAchievementRate: number | null; // percentage 0–100
  kpiPassRates: KpiPassRateStat[];
  topFailures: FailureFrequencyStat[];
  updatedAt: string; // ISO timestamp of last aggregate update
}

// ─── Recommendations ─────────────────────────────────────────────────────────
// Generated on-demand by the synthesis step (LLM looks at aggregates summary).
// Stamped with call count so the UI can show "based on N calls · X ago".

export type RecommendationOwner = "prompt" | "operations" | "qa" | "human_followup";
export type RecommendationPriority = "high" | "medium" | "low";

export interface AgentRecommendation {
  id: string;
  title: string;
  description: string;
  owner: RecommendationOwner;
  priority: RecommendationPriority;
  affectedKpiId: string;
  generatedAt: string;
  basedOnCallCount: number;
}

// ─── Agent Document ───────────────────────────────────────────────────────────
// MongoDB collection: `agents`

export interface Agent {
  id: string;            // internal ID (same as MongoDB _id as string)
  hlAgentId: string;     // HighLevel native agent ID
  locationId: string;
  companyId?: string;

  name: string;
  goal: string;
  channels: string[];
  status: string;

  // LLM-derived understanding of the agent
  derivedProfile: DerivedAgentProfile;

  // KPI blueprint is stored in the agent_kpi_blueprints collection (see kpiRepository)
  kpiGeneratedAt: string;
  kpiGenerationSource: "llm" | "fallback";
  metadataFingerprint: string; // hash of name+goal+channels — used to skip redundant KPI regeneration

  // Running aggregates — updated on each new evaluated call
  aggregates: AgentAggregates;

  // On-demand synthesis output
  recommendations: AgentRecommendation[];
  recommendationsGeneratedAt?: string; // undefined if never synthesized

  // HighLevel timestamps
  hlLastUpdatedAt?: string;
  hlCreatedAt?: string;

  // Our own timestamps
  syncedAt: string;
  createdAt: string;
  updatedAt: string;
}
