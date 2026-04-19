import { appInstallationRepository } from "../repositories/appInstallationRepository.js";
import { tokenRepository } from "../repositories/tokenRepository.js";
import type {
  AppInstallationRecord,
  AppInstallWebhookPayload
} from "../types.js";

class WebhookService {
  private buildInstallationRecord(
    payload: AppInstallWebhookPayload
  ): AppInstallationRecord {
    if (!payload.appId) {
      throw new Error("appId is required");
    }

    const now = new Date().toISOString();
    const installationScope = payload.locationId ? "location" : "agency";

    return {
      appId: payload.appId,
      companyId: payload.companyId,
      locationId: payload.locationId,
      userId: payload.userId,
      planId: payload.planId,
      companyName: payload.companyName,
      isWhitelabelCompany: payload.isWhitelabelCompany,
      whitelabelDetails: payload.whitelabelDetails,
      trial: payload.trial,
      installationScope,
      source: "highlevel_app_install_webhook",
      status: payload.type === "UNINSTALL" ? "uninstalled" : "installed",
      rawPayload: payload,
      installedAt: now,
      uninstalledAt: payload.type === "UNINSTALL" ? now : undefined,
      updatedAt: now
    };
  }

  async recordAppInstall(
    payload: AppInstallWebhookPayload
  ): Promise<AppInstallationRecord> {
    const record = this.buildInstallationRecord(payload);
    return appInstallationRepository.upsert(record);
  }

  async recordAppUninstall(
    payload: AppInstallWebhookPayload
  ): Promise<AppInstallationRecord> {
    const record = this.buildInstallationRecord(payload);
    const saved = await appInstallationRepository.upsert(record);

    if (payload.locationId) {
      await tokenRepository.deleteByLocationId(payload.locationId);
    }

    if (!payload.locationId && payload.companyId) {
      await tokenRepository.deleteByCompanyId(payload.companyId);
    }

    return saved;
  }
}

export const webhookService = new WebhookService();
