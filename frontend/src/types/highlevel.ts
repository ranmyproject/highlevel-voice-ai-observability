export type KpiStatus = "achieved" | "deviated" | "failed" | "missed" | "skipped" | "unreachable";

export type CallEndType = "completed" | "cut_short" | "caller_hangup" | "wrong_number";

export interface AgentKpiItem {
  id: string;
  kpi: string; // plain English KPI description
}

export interface StoredKpiBlueprint {
  agentId: string;
  locationId: string;
  kpis: AgentKpiItem[];
  generatedAt: string;
  source: "llm";
  metadataFingerprint: string;
}

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

export interface StoredHighLevelVoiceAgent {
  id: string;
  locationId: string;
  companyId?: string;
  name: string;
  status: string;
  channels: string[];
  goal: string;
  lastUpdatedAt?: string;
  createdAt?: string;
  derivedProfile: DerivedAgentProfile;
  kpiGeneratedAt: string;
  kpiGenerationSource: "llm" | "fallback";
  metadataFingerprint: string;
  aggregates?: AgentAggregates;
  recommendations?: AgentRecommendation[];
  latestFeedbackCycle?: AgentFeedbackCycle;
  detailPayload: Record<string, unknown>;
  syncedAt: string;
}

export interface HighLevelVoiceAgentListResponse {
  locationId: string;
  syncedAt: string;
  count: number;
  agents: StoredHighLevelVoiceAgent[];
}

export interface TranscriptKpiResult {
  kpiId: string;
  kpi: string;
  status: KpiStatus;
  evidence: string;
  fix: string | null;
  humanFollowup?: boolean;
}

export interface TranscriptEvaluation {
  callId: string;
  locationId: string;
  agentId: string;
  evaluatedAt: string;
  model: string;
  transcriptFingerprint: string;
  agentMetadataFingerprint: string;
  goalAchieved: boolean;
  overallScore: number;
  summary: string;
  callEndType: CallEndType;
  topFix: string | null;
  promptSnippet: string | null;
  kpiResults: TranscriptKpiResult[];
}

export interface CallMonitorSignal {
  id: string;
  label: string;
  type: "success" | "failure" | "uncertainty";
  source: "summary" | "transcript" | "extracted_data" | "duration" | "status" | "action";
  weight: number;
  matched: boolean;
  evidence?: string;
}

export interface CallMonitorDecision {
  callId: string;
  locationId: string;
  agentId: string;
  evaluatedAt: string;
  objectiveStatus: "achieved" | "failed" | "uncertain";
  shouldAnalyze: boolean;
  analyzeReason:
    | "objective_failed"
    | "objective_uncertain"
    | "qa_sample"
    | "skipped_high_confidence_success";
  successScore: number;
  failureScore: number;
  uncertaintyScore: number;
  confidence: number;
  matchedSignals: CallMonitorSignal[];
  expectedActions: string[];
  missingRequirements: string[];
  notes: string[];
}

export interface AgentKpiAggregate {
  kpiId: string;
  kpi: string;
  achieved: number;
  deviated: number;
  failed: number;
  missed: number;
  total: number;
}

export interface AgentAggregates {
  totalCalls: number;
  evaluatedCalls: number;
  overallScore: number;
  goalAchievementRate: number;
  kpiAggregates: AgentKpiAggregate[];
  topFailures: string[];
  topDeviations: string[];
  topMissed: string[];
  lastEvaluatedAt: string;
}

export interface AgentRecommendation {
  id: string;
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
  owner: "prompt" | "operations" | "qa";
  basedOnCallCount: number;
  generatedAt: string;
}

export interface AgentFeedbackCycle {
  id: string;
  agentId: string;
  locationId: string;
  generatedAt: string;
  summary: string;
  healthStatus: "healthy" | "needs_attention" | "at_risk" | "insufficient_data";
  monitorSummary: {
    totalCalls: number;
    achievedCalls: number;
    failedCalls: number;
    uncertainCalls: number;
    llmAnalyzedCalls: number;
    skippedCalls: number;
  };
  weakestKpis: Array<{
    kpiId: string;
    kpi: string;
    issueRate: number;
  }>;
  recommendations: AgentRecommendation[];
  nextActions: string[];
}

export interface StoredHighLevelVoiceCall {
  id: string;
  locationId: string;
  companyId?: string;
  agentId: string;
  caller: string;
  durationSec: number;
  status: string;
  transcript: string;
  summary: string;
  extractedData: Record<string, unknown>;
  startedAt?: string;
  lastUpdatedAt?: string;
  syncedAt: string;
  monitor?: CallMonitorDecision;
}

export interface AgentAnalysisWorkspace {
  agent: StoredHighLevelVoiceAgent;
  kpiBlueprint: StoredKpiBlueprint | null;
  calls: StoredHighLevelVoiceCall[];
  evaluations: TranscriptEvaluation[];
}

export interface HighLevelVoiceCallListResponse {
  locationId: string;
  syncedAt: string;
  count: number;
  calls: StoredHighLevelVoiceCall[];
}
