export type IssueSeverity = "info" | "medium" | "high";

export type IssueId =
  | "long_call"
  | "pricing_confusion"
  | "missed_booking"
  | "insurance_gap"
  | "missed_objection_handling"
  | "urgent_case"
  | "missing_required_data"
  | "slow_triage";

export interface AgentKpis {
  bookingRateTarget: number;
  complianceTarget: number;
  avgHandleTimeTargetSec: number;
}

export interface Agent {
  id: string;
  name: string;
  channel: string;
  goal: string;
  scriptFocus: string[];
  kpis: AgentKpis;
}

export interface Transcript {
  id: string;
  agentId: string;
  caller: string;
  timestamp: string;
  durationSec: number;
  booked: boolean;
  interventionRequired: boolean;
  actionItems: string[];
  issues: IssueId[];
  transcript: string;
}

export interface TranscriptInput {
  id: string;
  agentId: string;
  caller: string;
  timestamp: string;
  durationSec: number;
  booked: boolean;
  interventionRequired: boolean;
  transcript: string;
}

export interface IssueDefinition {
  label: string;
  severity: IssueSeverity;
  recommendation: string;
}

export interface TranscriptIssueSummary extends IssueDefinition {
  id: IssueId;
}

export interface AgentIssue extends TranscriptIssueSummary {
  transcriptId: string;
  timestamp: string;
  caller: string;
}

export interface Recommendation {
  issueId: IssueId;
  count: number;
  label: string;
  recommendation: string;
}

export interface UseAction {
  transcriptId: string;
  caller: string;
  timestamp: string;
  action: string;
}

export interface AgentSummary {
  totalCalls: number;
  bookings: number;
  escalations: number;
  bookingRate: number;
  complianceRate: number;
  averageHandleTimeSec: number;
  bookingRateDelta: number;
  complianceDelta: number;
  handleTimeDeltaSec: number;
}

export interface AnalyzedTranscript extends Transcript {
  analyzedIssues: TranscriptIssueSummary[];
}

export interface AgentAnalysis {
  agent: Agent;
  summary: AgentSummary;
  issues: AgentIssue[];
  recommendations: Recommendation[];
  useActions: UseAction[];
  transcripts: AnalyzedTranscript[];
}

export interface DashboardOverview {
  totalCalls: number;
  bookings: number;
  escalations: number;
  totalIssueCount: number;
  bookingRate: number;
}

export interface DashboardAgentSummary {
  id: string;
  name: string;
  goal: string;
  channel: string;
  summary: AgentSummary;
  topIssue: string;
}

export interface DashboardIssueFeedItem extends AgentIssue {
  agentId: string;
  agentName: string;
}

export interface DashboardResponse {
  generatedAt: string;
  overview: DashboardOverview;
  agentSummaries: DashboardAgentSummary[];
  issuesFeed: DashboardIssueFeedItem[];
}

export interface IngestTranscriptRequestBody {
  agentId: string;
  caller: string;
  transcript: string;
  durationSec: number;
  booked?: boolean;
  interventionRequired?: boolean;
}

export interface TrialDetails {
  onTrial: boolean;
  trialDuration: number;
  trialStartDate: string;
}

export interface WhitelabelDetails {
  domain?: string;
  logoUrl?: string;
}

export interface AppInstallWebhookPayload {
  type: "INSTALL" | "UNINSTALL";
  appId: string;
  companyId?: string;
  locationId?: string;
  userId?: string;
  planId?: string;
  trial?: TrialDetails;
  isWhitelabelCompany?: boolean;
  whitelabelDetails?: WhitelabelDetails;
  companyName?: string;
}

export interface AppInstallationRecord {
  appId: string;
  companyId?: string;
  locationId?: string;
  userId?: string;
  planId?: string;
  companyName?: string;
  isWhitelabelCompany?: boolean;
  whitelabelDetails?: WhitelabelDetails;
  trial?: TrialDetails;
  installationScope: "location" | "agency";
  source: "highlevel_app_install_webhook";
  status: "installed" | "uninstalled";
  rawPayload: AppInstallWebhookPayload;
  installedAt: string;
  uninstalledAt?: string;
  updatedAt: string;
}

export interface OAuthTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  scope?: string;
  userType?: string;
  companyId?: string;
  locationId?: string;
  userId?: string;
}

export interface InstallationTokenRecord {
  companyId?: string;
  locationId?: string;
  userId?: string;
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  scope?: string;
  userType?: string;
  expiresAt: string;
  source: "highlevel_oauth_callback";
  installedAt: string;
  updatedAt: string;
  rawTokenResponse: OAuthTokenResponse;
}

export interface AgentListItem {
  id: string;
  name?: string;
  status?: string;
  channels?: string[];
  updatedAt?: string;
  createdAt?: string;
  goal?: string;
  [key: string]: unknown;
}

export interface AgentDetail extends AgentListItem {
  [key: string]: unknown;
}

export type KpiStatus = "achieved" | "deviated" | "failed" | "missed" | "skipped" | "unreachable";

export type CallEndType = "completed" | "cut_short" | "caller_hangup" | "wrong_number";

// A KPI is a plain-English description of what a good call should do or avoid.
// The LLM evaluates each KPI against the transcript without needing type categories.
export interface AgentKpiItem {
  id: string; // snake_case, stable key for aggregation
  kpi: string; // plain English description, e.g. "Confirm a next step before ending the call"
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

export interface StoredAgent {
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
  lastCallSyncedAt?: string;
  aggregates?: AgentAggregates;
  recommendations?: AgentRecommendation[];
  latestFeedbackCycle?: AgentFeedbackCycle;
  lastPromptUpdateAt?: string;
  lastAppliedRecommendationIds?: string[];
  listPayload: AgentListItem;
  detailPayload: AgentDetail;
  syncedAt: string;
}

export interface AgentListResponse {
  locationId: string;
  syncedAt: string;
  count: number;
  agents: StoredAgent[];
}

export interface VoiceCall {
  id: string;
  agentId?: string;
  duration?: number;
  transcript?: string;
  summary?: string;
  caller?: string;
  createdAt?: string;
  updatedAt?: string;
  status?: string;
  [key: string]: unknown;
}

export interface VoiceCallDetail extends VoiceCall {
  extractedData?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface StoredVoiceCall {
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
  listPayload: VoiceCall;
  detailPayload: VoiceCallDetail;
  syncedAt: string;
}

export interface VoiceCallListResponse {
  locationId: string;
  syncedAt: string;
  count: number;
  calls: StoredVoiceCall[];
}

export interface TranscriptKpiResult {
  kpiId: string;
  kpi: string; // plain English echoed from blueprint
  status: KpiStatus;
  evidence: string; // verbatim quote from transcript that drove this classification
  fix: string | null; // direct, specific prompt fix; null if achieved
  humanFollowup?: boolean; // true if a human must follow up with this caller
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
  topFix: string | null; // single most important improvement for this call
  promptSnippet: string | null; // ready-to-use text to add to agent prompt
  kpiResults: TranscriptKpiResult[];
}

export interface AgentKpiAggregate {
  kpiId: string;
  kpi: string; // plain English
  achieved: number;
  deviated: number;
  failed: number;
  missed: number;
  total: number; // achieved + deviated + failed + missed (skipped excluded)
}

export interface AgentAggregates {
  totalCalls: number;
  evaluatedCalls: number;
  overallScore: number;
  goalAchievementRate: number;
  kpiAggregates: AgentKpiAggregate[];
  topFailures: string[]; // KPI descriptions most frequently failed
  topDeviations: string[]; // KPI descriptions most frequently deviated
  topMissed: string[]; // KPI descriptions most frequently missed
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
  weakestKpis: Array<{
    kpiId: string;
    kpi: string;
    issueRate: number; // % of calls where status was deviated, failed, or missed
  }>;
  recommendations: AgentRecommendation[];
  nextActions: string[];
}

export interface AgentChangeApplication {
  id: string;
  locationId: string;
  agentId: string;
  recommendationId: string;
  target: "agent" | "action";
  owner: "prompt" | "operations" | "qa";
  appliedAt: string;
  recommendationTitle: string;
  recommendationDescription: string;
  patchSummary: string;
}

export interface AgentAnalysisWorkspace {
  agent: StoredAgent;
  kpiBlueprint: StoredKpiBlueprint | null;
  calls: StoredVoiceCall[];
  evaluations: TranscriptEvaluation[];
}
