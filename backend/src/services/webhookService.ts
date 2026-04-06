import { appInstallationRepository } from "../repositories/appInstallationRepository.js";
import type {
  AppInstallationRecord,
  AppInstallWebhookPayload
} from "../types.js";

class WebhookService {
  async recordAppInstall(
    payload: AppInstallWebhookPayload
  ): Promise<AppInstallationRecord> {
    if (!payload.appId) {
      throw new Error("appId is required");
    }

    const now = new Date().toISOString();
    const installationScope = payload.locationId ? "location" : "agency";

    const record: AppInstallationRecord = {
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
      status: "installed",
      rawPayload: payload,
      installedAt: now,
      updatedAt: now
    };

    return appInstallationRepository.upsert(record);
  }
}

export const webhookService = new WebhookService();
