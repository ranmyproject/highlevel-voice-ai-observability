import { Router } from "express";

import { exchangeOAuthCode, oauthCallback } from "../controllers/oauthController.js";
import { asyncHandler } from "../handlers/asyncHandler.js";

export const oauthRouter = Router();

oauthRouter.post("/oauth/exchange", asyncHandler(exchangeOAuthCode));

// GHL redirects to this URL after app install (set as Redirect URI in GHL marketplace)
oauthRouter.get("/oauth/callback", asyncHandler(oauthCallback));
