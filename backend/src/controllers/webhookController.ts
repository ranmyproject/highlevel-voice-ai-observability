import type { Request, Response } from "express";

import { HttpError } from "../errors/HttpError.js";
import { webhookService } from "../services/webhookService.js";
import type { AppInstallWebhookPayload } from "../types.js";

export async function handleAppInstallWebhook(
  request: Request<any, any, AppInstallWebhookPayload>,
  response: Response
): Promise<void> {
  if (request.body.type !== "INSTALL") {
    throw new HttpError(400, "Unsupported webhook type");
  }

  if (!request.body.appId) {
    throw new HttpError(400, "appId is required");
  }

  const installation = await webhookService.recordAppInstall(request.body);

  response.status(202).json({
    message: "App installation webhook received",
    installation
  });
}
