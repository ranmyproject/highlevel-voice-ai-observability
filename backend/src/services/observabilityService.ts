import { agentRepository } from "../repositories/agentRepository.js";
import { transcriptRepository } from "../repositories/transcriptRepository.js";
import type {
  AgentAnalysis,
  DashboardResponse,
  IngestTranscriptRequestBody,
  StoredAgent,
  Transcript
} from "../types.js";
import { analyzeAgent, analyzeTranscript, buildDashboard } from "./analysisService.js";

class ObservabilityService {
  async listAgents(locationId: string): Promise<StoredAgent[]> {
    return agentRepository.findByLocationId(locationId);
  }

  async getDashboard(locationId: string): Promise<DashboardResponse> {
    const [agents, transcripts] = await Promise.all([
      agentRepository.findByLocationId(locationId),
      transcriptRepository.findAll()
    ]);

    return buildDashboard(agents, transcripts);
  }

  async getAgentAnalysis(
    locationId: string,
    agentId: string
  ): Promise<AgentAnalysis | null> {
    const agent = await agentRepository.findOne(locationId, agentId);

    if (!agent) {
      return null;
    }

    const agentTranscripts = await transcriptRepository.findByAgentId(agentId);
    return analyzeAgent(agent, agentTranscripts);
  }

  async ingestTranscript(
    locationId: string,
    payload: IngestTranscriptRequestBody
  ): Promise<{ transcript: Transcript; dashboard: DashboardResponse; agent: AgentAnalysis }> {
    const agent = await agentRepository.findOne(locationId, payload.agentId);

    if (!agent) {
      throw new Error("Unknown agentId for this location");
    }

    if (!payload.caller || !payload.transcript || typeof payload.durationSec !== "number") {
      throw new Error("caller, transcript, and numeric durationSec are required");
    }

    const analyzedTranscript = analyzeTranscript(agent, {
      id: `t-${Date.now()}`,
      agentId: payload.agentId,
      caller: payload.caller,
      transcript: payload.transcript,
      durationSec: payload.durationSec,
      booked: payload.booked ?? false,
      interventionRequired: payload.interventionRequired ?? false,
      timestamp: new Date().toISOString()
    });

    await transcriptRepository.create(analyzedTranscript);

    const [agents, transcripts, agentTranscripts] = await Promise.all([
      agentRepository.findByLocationId(locationId),
      transcriptRepository.findAll(),
      transcriptRepository.findByAgentId(payload.agentId)
    ]);

    return {
      transcript: analyzedTranscript,
      dashboard: buildDashboard(agents, transcripts),
      agent: analyzeAgent(agent, agentTranscripts)
    };
  }
}

export const observabilityService = new ObservabilityService();
