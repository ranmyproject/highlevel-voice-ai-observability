import { httpClient } from "./httpClient";
import type { AgentDetailResponse, DashboardResponse, IngestFormState, IngestTranscriptResponse } from "../types/observability";
import type {
  AgentAnalysisWorkspace,
  AgentFeedbackCycle,
  HighLevelVoiceAgentListResponse,
  HighLevelVoiceCallListResponse,
  TranscriptEvaluation
} from "../types/highlevel";

class ObservabilityApi {
  verifyLocation(locationId: string): Promise<{ locationId: string; token: string; tokenType: string; expiresIn: number }> {
    return httpClient.post("/auth/verify", { locationId });
  }

  exchangeOAuthCode(code: string, userType: string = "Location"): Promise<{ locationId: string; companyId: string; token: string }> {
    return httpClient.post("/oauth/exchange", { code, userType });
  }

  getDashboard(): Promise<DashboardResponse> {
    return httpClient.get("/dashboard");
  }

  getAgent(agentId: string): Promise<AgentAnalysisWorkspace> {
    return httpClient.get(`/agents/${agentId}`);
  }

  ingestTranscript(payload: IngestFormState): Promise<IngestTranscriptResponse> {
    return httpClient.post("/calls/ingest", payload);
  }

  getHighLevelVoiceAgents(): Promise<HighLevelVoiceAgentListResponse> {
    return httpClient.get("/agents");
  }

  syncHighLevelVoiceAgents(): Promise<HighLevelVoiceAgentListResponse> {
    return httpClient.post("/agents/sync", {});
  }

  syncHighLevelVoiceCalls(agentId?: string): Promise<HighLevelVoiceCallListResponse> {
    const qs = agentId ? `?agentId=${agentId}` : "";
    return httpClient.post(`/calls/sync${qs}`, {});
  }

  analyzeHighLevelAgentCalls(
    agentId: string
  ): Promise<{ analyzedCount: number; evaluations: TranscriptEvaluation[]; feedbackCycle: AgentFeedbackCycle }> {
    return httpClient.post(`/agents/${agentId}/analyze`, {});
  }

  applyRecommendations(
    agentId: string,
    recommendationIds: string[]
  ): Promise<{
    success: boolean;
    agentId: string;
    appliedAt: string;
    appliedCount: number;
    appliedRecommendationIds: string[];
    remainingRecommendationCount: number;
    promptFieldKey: string;
    updatedPromptPreview: string;
    refreshRecommended: boolean;
  }> {
    return httpClient.post(`/agents/${agentId}/apply-recommendations`, { recommendationIds });
  }

  applyRecommendation(
    agentId: string,
    recommendationId: string
  ): Promise<{
    success: boolean;
    agentId: string;
    recommendationId: string;
    appliedAt: string;
    appliedCount: number;
    appliedRecommendationIds: string[];
    remainingRecommendationCount: number;
    promptFieldKey: string;
    updatedPromptPreview: string;
    refreshRecommended: boolean;
  }> {
    return httpClient.post(`/agents/${agentId}/apply-recommendation`, { recommendationId });
  }
}

export const observabilityApi = new ObservabilityApi();
