import { Router } from "express";

import { handleAppInstallWebhook } from "../controllers/webhookController.js";
import { asyncHandler } from "../handlers/asyncHandler.js";

export const webhookRouter = Router();

webhookRouter.post(
  "/webhooks/highlevel/app-install",
  asyncHandler(handleAppInstallWebhook)
);
