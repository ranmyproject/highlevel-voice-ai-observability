import { env } from "../config/env.js";
import { appInstallationRepository } from "../repositories/appInstallationRepository.js";
import { tokenRepository } from "../repositories/tokenRepository.js";
import { logger } from "../utils/logger.js";
import type {
  InstallationTokenRecord,
  OAuthTokenResponse
} from "../types.js";

class HighLevelAuthService {
  private async assertInstallationActive(locationId: string, companyId?: string): Promise<void> {
    const locationInstall = await appInstallationRepository.findByLocationId(locationId);

    if (locationInstall?.status === "uninstalled") {
      throw new Error("HighLevel app is uninstalled for this location");
    }

    if (locationInstall?.status === "installed") {
      return;
    }

    if (!companyId) {
      return;
    }

    const companyInstall = await appInstallationRepository.findByCompanyId(companyId);
    if (companyInstall?.status === "uninstalled") {
      throw new Error("HighLevel app is uninstalled for this location");
    }
  }

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

  async exchangeCodeForTokens(code: string, userType: string = "Location"): Promise<InstallationTokenRecord> {
    logger.info("HighLevelAuthService", "exchangeCodeForTokens called", { userType });

    if (!env.highlevelClientId || !env.highlevelClientSecret) {
      logger.error("HighLevelAuthService", "OAuth credentials are not configured");
      throw new Error("HighLevel OAuth credentials are not configured");
    }

    const tokenPayload = await this.exchangeToken({
      client_id: env.highlevelClientId,
      client_secret: env.highlevelClientSecret,
      grant_type: "authorization_code",
      code,
      user_type: userType,
      redirect_uri: env.highlevelRedirectUri
    });

    const record = this.buildTokenRecord(tokenPayload, "highlevel_oauth_callback");
    const saved = await tokenRepository.upsert(record);

    logger.info("HighLevelAuthService", "Token stored after OAuth code exchange", { locationId: saved.locationId, companyId: saved.companyId, userType: saved.userType });
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
      user_type: tokenRecord.userType || "Location",
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

    if (locationId) {
      await this.assertInstallationActive(locationId);
    }

    let tokenRecord = locationId ? await tokenRepository.findByLocationId(locationId) : await tokenRepository.findLatest();

    if (!tokenRecord && locationId) {
      const dbInstall = await appInstallationRepository.findByLocationId(locationId);

      if (dbInstall?.companyId) {
        // We know exactly what company token to pull from the webhook mapping!
        tokenRecord = await tokenRepository.findByCompanyId(dbInstall.companyId);
      }

      // DISCOVERY FLOW: If mapping was missing (e.g. webhook delayed), discover it using an Agency token!
      if (!tokenRecord) {
        const agencyToken = await tokenRepository.findLatestAgencyToken() || await tokenRepository.findLatest();
        if (agencyToken) {
          try {
            const locationDetails = await this.fetchLocationDetails(agencyToken.accessToken, locationId);
            if (locationDetails.companyId) {
              // Log the mapping for future requests
              await appInstallationRepository.upsert({
                appId: env.highlevelClientId || "voice-ai-observability",
                companyId: locationDetails.companyId,
                locationId,
                installationScope: "location",
                source: "highlevel_app_install_webhook",
                status: "installed",
                rawPayload: locationDetails as any,
                installedAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
              });
              tokenRecord = await tokenRepository.findByCompanyId(locationDetails.companyId);
            }
          } catch (discoveryErr) {
            logger.warn("HighLevelAuthService", "Automatic parent company discovery failed", { locationId });
          }
        }
      }

      // Fallback to latest available token if specific mapping still failed
      if (!tokenRecord) {
        tokenRecord = await tokenRepository.findLatest();
      }
    }

    if (!tokenRecord) {
      logger.error("HighLevelAuthService", "No HighLevel installation token found", { locationId });
      throw new Error("No HighLevel installation token found");
    }

    const expiresAt = new Date(tokenRecord.expiresAt).getTime();
    const shouldRefresh = expiresAt - Date.now() < 60_000;

    if (shouldRefresh) {
      logger.info("HighLevelAuthService", "Token near expiry, triggering refresh", { locationId, expiresAt: tokenRecord.expiresAt });
      tokenRecord = await this.refreshTokenRecord(tokenRecord);
    } else {
      logger.debug("HighLevelAuthService", "Using cached token (not expired)", { locationId, expiresAt: tokenRecord.expiresAt });
    }

    // IF token is an Agency/Company Token AND we are requesting a specific Location ID,
    // we MUST downgrade it to a Location Token via the /oauth/locationToken endpoint!
    if (tokenRecord.companyId && !tokenRecord.locationId && locationId) {
      await this.assertInstallationActive(locationId, tokenRecord.companyId);
      return this.exchangeCompanyForLocationToken(tokenRecord, locationId);
    }

    if (locationId) {
      await this.assertInstallationActive(locationId, tokenRecord.companyId);
    }

    return tokenRecord;
  }

  private async exchangeCompanyForLocationToken(companyRecord: InstallationTokenRecord, locationId: string): Promise<InstallationTokenRecord> {
    logger.info("HighLevelAuthService", "Exchanging Company access_token for Location sub-token", { companyId: companyRecord.companyId, locationId });

    const response = await fetch("https://services.leadconnectorhq.com/oauth/locationToken", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": `Bearer ${companyRecord.accessToken}`,
        "Version": "2021-07-28"
      },
      body: new URLSearchParams({
        companyId: companyRecord.companyId as string,
        locationId
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error("HighLevelAuthService", "Failed to get location sub-token", { status: response.status, body: errorText });
      throw new Error(`Failed to generate Location Token from Agency Token: ${response.status}`);
    }

    const payload = await response.json();

    // Create a new record for this specific Location.
    // Note: Agency sub-tokens don't usually have their own refresh_token; 
    // we use the parent Agency's refresh_token if needed.
    const record: InstallationTokenRecord = {
      ...companyRecord,
      accessToken: payload.access_token,
      refreshToken: companyRecord.refreshToken,
      companyId: payload.companyId || companyRecord.companyId,
      locationId: payload.locationId || locationId,
      userType: payload.userType || "Location",
      expiresAt: new Date(Date.now() + (payload.expires_in || 86400) * 1000).toISOString(),
      updatedAt: new Date().toISOString()
    };

    return tokenRepository.upsert(record);
  }

  private async fetchLocationDetails(accessToken: string, locationId: string): Promise<{ companyId: string;[key: string]: any }> {
    logger.info("HighLevelAuthService", "Fetching location details to discover parent companyId", { locationId });

    const response = await fetch(`https://services.leadconnectorhq.com/locations/${locationId}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Version": "2021-07-28"
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error("HighLevelAuthService", "HighLevel Location lookup failed", { status: response.status, body: errorText });
      throw new Error(`Location lookup failed: ${response.status}`);
    }

    const data = await response.json();
    const companyId = data.location?.companyId || data.companyId;

    if (!companyId) {
      throw new Error("Location details response did not contain a companyId");
    }

    return { ...data.location, companyId };
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
