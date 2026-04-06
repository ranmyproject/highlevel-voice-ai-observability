import { Router } from "express";

import { handleHighLevelOAuthCallback } from "../controllers/oauthController.js";
import { asyncHandler } from "../handlers/asyncHandler.js";

export const oauthRouter = Router();

oauthRouter.get("/oauth/callback", asyncHandler(handleHighLevelOAuthCallback));
