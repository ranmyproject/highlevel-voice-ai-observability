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

export interface DashboardAgentSummary {
  id: string;
  name: string;
  goal: string;
  channel: string;
  summary: AgentSummary;
  topIssue: string;
}

export interface DashboardIssueFeedItem {
  agentId: string;
  agentName: string;
  transcriptId: string;
  timestamp: string;
  caller: string;
  id: string;
  label: string;
  severity: string;
  recommendation: string;
}

export interface DashboardResponse {
  generatedAt: string;
  overview: {
    totalCalls: number;
    bookings: number;
    escalations: number;
    totalIssueCount: number;
    bookingRate: number;
  };
  agentSummaries: DashboardAgentSummary[];
  issuesFeed: DashboardIssueFeedItem[];
}

export interface TranscriptIssue {
  id: string;
  label: string;
  severity: string;
  recommendation: string;
}

export interface TranscriptItem {
  id: string;
  caller: string;
  transcript: string;
  booked: boolean;
  analyzedIssues: TranscriptIssue[];
}

export interface RecommendationItem {
  issueId: string;
  count: number;
  label: string;
  recommendation: string;
}

export interface UseActionItem {
  transcriptId: string;
  caller: string;
  timestamp: string;
  action: string;
}

export interface AgentDetailResponse {
  agent: {
    id: string;
    name: string;
    channel: string;
    goal: string;
  };
  summary: AgentSummary;
  recommendations: RecommendationItem[];
  useActions: UseActionItem[];
  transcripts: TranscriptItem[];
}

export interface IngestFormState {
  agentId: string;
  caller: string;
  durationSec: number;
  booked: boolean;
  transcript: string;
}

export interface IngestTranscriptResponse {
  transcript: TranscriptItem;
  dashboard: DashboardResponse;
  agent: AgentDetailResponse;
}

export interface SummaryCard {
  label: string;
  value: number | string;
  detail: string;
}

export interface AgentKpiBlueprint {
  id: string;
  label: string;
  description: string;
  source: "goal" | "workflow" | "compliance" | "efficiency";
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
  kpiBlueprint: AgentKpiBlueprint[];
  detailPayload: Record<string, unknown>;
  syncedAt: string;
}

export interface HighLevelVoiceAgentListResponse {
  locationId: string;
  syncedAt: string;
  count: number;
  agents: StoredHighLevelVoiceAgent[];
}
