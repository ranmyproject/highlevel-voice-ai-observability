// Core domain types — 2-collection model
export * from "./agent.js";
export * from "./call.js";

// ─── HighLevel OAuth / Webhook types ─────────────────────────────────────────
// Not domain-specific but required for the HighLevel integration layer.

export interface HighLevelTrialDetails {
  onTrial: boolean;
  trialDuration: number;
  trialStartDate: string;
}

export interface HighLevelWhitelabelDetails {
  domain?: string;
  logoUrl?: string;
}

export interface HighLevelAppInstallWebhookPayload {
  type: "INSTALL";
  appId: string;
  companyId?: string;
  locationId?: string;
  userId?: string;
  planId?: string;
  trial?: HighLevelTrialDetails;
  isWhitelabelCompany?: boolean;
  whitelabelDetails?: HighLevelWhitelabelDetails;
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
  whitelabelDetails?: HighLevelWhitelabelDetails;
  trial?: HighLevelTrialDetails;
  installationScope: "location" | "agency";
  source: "highlevel_app_install_webhook";
  status: "installed";
  rawPayload: HighLevelAppInstallWebhookPayload;
  installedAt: string;
  updatedAt: string;
}

export interface HighLevelOAuthTokenResponse {
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

export interface HighLevelInstallationTokenRecord {
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
  rawTokenResponse: HighLevelOAuthTokenResponse;
}

// ─── HighLevel API response shapes ───────────────────────────────────────────
// Raw payloads from the HighLevel API — stored on Agent/Call for audit purposes.

export interface HighLevelVoiceAgentListItem {
  id: string;
  name?: string;
  status?: string;
  channels?: string[];
  updatedAt?: string;
  createdAt?: string;
  goal?: string;
  [key: string]: unknown;
}

export interface HighLevelVoiceAgentDetail extends HighLevelVoiceAgentListItem {
  [key: string]: unknown;
}

export interface HighLevelVoiceCallLogListItem {
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

export interface HighLevelVoiceCallLogDetail extends HighLevelVoiceCallLogListItem {
  extractedData?: Record<string, unknown>;
  [key: string]: unknown;
}

// ─── API response wrappers ────────────────────────────────────────────────────

export interface AgentListResponse {
  locationId: string;
  syncedAt: string;
  count: number;
  agents: import("./agent.js").Agent[];
}

export interface CallListResponse {
  locationId: string;
  syncedAt: string;
  count: number;
  calls: import("./call.js").Call[];
}

// Workspace bundles an agent with its calls for the detail page
export interface AgentWorkspace {
  agent: import("./agent.js").Agent;
  calls: import("./call.js").Call[];
}
