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

  if (request.body.type !== "INSTALL") {
    logger.warn("WebhookController", "Unsupported webhook type received", { type: request.body.type });
    throw new HttpError(400, "Unsupported webhook type");
  }

  if (!request.body.appId) {
    logger.error("WebhookController", "Missing appId in INSTALL webhook payload");
    throw new HttpError(400, "appId is required");
  }

  const installation = await webhookService.recordAppInstall(request.body);

  logger.info("WebhookController", "App installation recorded successfully", {
    locationId: installation.locationId,
    companyId: installation.companyId,
    scope: installation.installationScope
  });

  response.status(202).json({
    message: "App installation webhook received",
    installation
  });
}
