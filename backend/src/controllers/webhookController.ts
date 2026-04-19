import type { Request, Response } from "express";

import { HttpError } from "../errors/HttpError.js";
import { webhookService } from "../services/webhookService.js";
import type { AppInstallWebhookPayload } from "../types.js";
import { logger } from "../utils/logger.js";

export async function handleAppInstallWebhook(
  request: Request<any, any, AppInstallWebhookPayload>,
  response: Response
): Promise<void> {
  logger.info("WebhookController", "Received HighLevel webhook", { type: request.body.type, payload: request.body });

  if (request.body.type !== "INSTALL" && request.body.type !== "UNINSTALL") {
    logger.warn("WebhookController", "Unsupported webhook type received", { type: request.body.type });
    throw new HttpError(400, "Unsupported webhook type");
  }

  if (!request.body.appId) {
    logger.error("WebhookController", "Missing appId in app webhook payload");
    throw new HttpError(400, "appId is required");
  }

  const installation =
    request.body.type === "UNINSTALL"
      ? await webhookService.recordAppUninstall(request.body)
      : await webhookService.recordAppInstall(request.body);

  logger.info("WebhookController", "App webhook recorded successfully", {
    type: request.body.type,
    locationId: installation.locationId,
    companyId: installation.companyId,
    scope: installation.installationScope,
    status: installation.status
  });

  response.status(202).json({
    message: `App ${request.body.type.toLowerCase()} webhook received`,
    installation
  });
}
