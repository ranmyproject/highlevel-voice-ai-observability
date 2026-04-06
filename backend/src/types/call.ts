// ─── Evaluation ───────────────────────────────────────────────────────────────
// Produced by the LLM analysis step. Embedded inside the Call document.

export interface CallKpiScore {
  kpiId: string;
  label: string;
  score: number;     // 0–100
  reasoning: string; // LLM explanation for the score
}

export type ActionableOwner = "prompt" | "operations" | "qa" | "human_followup";
export type ActionablePriority = "high" | "medium" | "low";

export interface CallActionable {
  id: string;
  title: string;
  description: string;
  owner: ActionableOwner;
  priority: ActionablePriority;
  sourceKpiId: string; // which KPI triggered this actionable
}

export interface CallEvaluation {
  overallScore: number;   // 0–100 weighted average across KPI scores
  goalAchieved: boolean;
  summary: string;        // 1–2 sentence call summary
  strengths: string[];
  failures: string[];     // what went wrong — used for aggregate failure frequency
  kpiScores: CallKpiScore[];
  actionables: CallActionable[];

  // Audit fields — used to detect when a call needs re-evaluation
  model: string;
  transcriptFingerprint: string;      // hash of transcript text
  agentMetadataFingerprint: string;   // hash of agent name+goal+channels
  analyzedAt: string;
}

// ─── Call Document ────────────────────────────────────────────────────────────
// MongoDB collection: `calls`

export interface Call {
  id: string;         // internal ID (same as MongoDB _id as string)
  hlCallId: string;   // HighLevel native call ID
  agentId: string;    // references Agent.id
  locationId: string;
  companyId?: string;

  caller: string;
  durationSec: number;
  status: string;
  transcript: string;
  summary: string;
  extractedData: Record<string, unknown>; // raw fields from HighLevel call detail

  evaluation?: CallEvaluation; // undefined until the call has been analyzed

  // HighLevel timestamps
  hlStartedAt?: string;
  hlLastUpdatedAt?: string;

  // Our own timestamps
  syncedAt: string;
  createdAt: string;
  updatedAt: string;
}
