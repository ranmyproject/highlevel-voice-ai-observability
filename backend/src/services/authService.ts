import { env } from "../config/env.js";
import { tokenRepository } from "../repositories/tokenRepository.js";
import { logger } from "../utils/logger.js";
import type {
  InstallationTokenRecord,
  OAuthTokenResponse
} from "../types.js";

class HighLevelAuthService {
  private async exchangeToken(
    payload: Record<string, string>
  ): Promise<OAuthTokenResponse> {
    logger.info("HighLevelAuthService", `→ POST ${env.highlevelTokenUrl}`, { grant_type: payload.grant_type });

    const response = await fetch(env.highlevelTokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json"
      },
      body: new URLSearchParams(payload)
    });

    logger.debug("HighLevelAuthService", `← ${response.status} ${response.statusText} from token endpoint`);

    if (!response.ok) {
      const errorBody = await response.text();
      logger.error("HighLevelAuthService", "Token exchange failed", { status: response.status, body: errorBody, grant_type: payload.grant_type });
      throw new Error(`HighLevel token exchange failed: ${response.status} ${errorBody}`);
    }

    logger.info("HighLevelAuthService", "Token exchange successful", { grant_type: payload.grant_type });
    return (await response.json()) as OAuthTokenResponse;
  }

  private buildTokenRecord(
    tokenPayload: OAuthTokenResponse,
    source: InstallationTokenRecord["source"]
  ): InstallationTokenRecord {
    const now = new Date();

    return {
      companyId: tokenPayload.companyId,
      locationId: tokenPayload.locationId,
      userId: tokenPayload.userId,
      accessToken: tokenPayload.access_token,
      refreshToken: tokenPayload.refresh_token,
      tokenType: tokenPayload.token_type,
      scope: tokenPayload.scope,
      userType: tokenPayload.userType,
      expiresAt: new Date(now.getTime() + tokenPayload.expires_in * 1000).toISOString(),
      source,
      installedAt: now.toISOString(),
      updatedAt: now.toISOString(),
      rawTokenResponse: tokenPayload
    };
  }

  async exchangeCodeForTokens(code: string): Promise<InstallationTokenRecord> {
    logger.info("HighLevelAuthService", "exchangeCodeForTokens called");

    if (!env.highlevelClientId || !env.highlevelClientSecret) {
      logger.error("HighLevelAuthService", "OAuth credentials are not configured");
      throw new Error("HighLevel OAuth credentials are not configured");
    }

    const tokenPayload = await this.exchangeToken({
      client_id: env.highlevelClientId,
      client_secret: env.highlevelClientSecret,
      grant_type: "authorization_code",
      code,
      user_type: "Company",
      redirect_uri: env.highlevelRedirectUri
    });

    const record = this.buildTokenRecord(tokenPayload, "highlevel_oauth_callback");
    const saved = await tokenRepository.upsert(record);

    logger.info("HighLevelAuthService", "Token stored after OAuth code exchange", { locationId: saved.locationId, companyId: saved.companyId });
    return saved;
  }

  private async refreshTokenRecord(
    tokenRecord: InstallationTokenRecord
  ): Promise<InstallationTokenRecord> {
    const refreshedPayload = await this.exchangeToken({
      client_id: env.highlevelClientId,
      client_secret: env.highlevelClientSecret,
      grant_type: "refresh_token",
      refresh_token: tokenRecord.refreshToken,
      user_type: tokenRecord.userType || "Company",
      redirect_uri: env.highlevelRedirectUri
    });

    const refreshedRecord = this.buildTokenRecord(
      {
        ...refreshedPayload,
        companyId: refreshedPayload.companyId || tokenRecord.companyId,
        locationId: refreshedPayload.locationId || tokenRecord.locationId,
        userId: refreshedPayload.userId || tokenRecord.userId
      },
      "highlevel_oauth_callback"
    );

    return tokenRepository.upsert(refreshedRecord);
  }

  async getValidToken(locationId?: string): Promise<InstallationTokenRecord> {
    logger.debug("HighLevelAuthService", "getValidToken called", { locationId });

    const tokenRecord = locationId
      ? await tokenRepository.findByLocationId(locationId)
      : await tokenRepository.findLatest();

    if (!tokenRecord) {
      logger.error("HighLevelAuthService", "No HighLevel installation token found", { locationId });
      throw new Error("No HighLevel installation token found");
    }

    const expiresAt = new Date(tokenRecord.expiresAt).getTime();
    const shouldRefresh = expiresAt - Date.now() < 60_000;

    if (!shouldRefresh) {
      logger.debug("HighLevelAuthService", "Using cached token (not expired)", { locationId, expiresAt: tokenRecord.expiresAt });
      return tokenRecord;
    }

    logger.info("HighLevelAuthService", "Token near expiry, triggering refresh", { locationId, expiresAt: tokenRecord.expiresAt });
    return this.refreshTokenRecord(tokenRecord);
  }

  async refreshToken(locationId?: string): Promise<InstallationTokenRecord> {
    logger.info("HighLevelAuthService", "Manual token refresh triggered", { locationId });

    const tokenRecord = locationId
      ? await tokenRepository.findByLocationId(locationId)
      : await tokenRepository.findLatest();

    if (!tokenRecord) {
      logger.error("HighLevelAuthService", "No token found for manual refresh", { locationId });
      throw new Error("No HighLevel installation token found");
    }

    const refreshed = await this.refreshTokenRecord(tokenRecord);
    logger.info("HighLevelAuthService", "Token refreshed successfully", { locationId: refreshed.locationId, expiresAt: refreshed.expiresAt });
    return refreshed;
  }
}

export const authService = new HighLevelAuthService();
