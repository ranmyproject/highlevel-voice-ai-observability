import { Router } from "express";

import { exchangeOAuthCode } from "../controllers/oauthController.js";
import { asyncHandler } from "../handlers/asyncHandler.js";

export const oauthRouter = Router();

oauthRouter.post("/oauth/exchange", asyncHandler(exchangeOAuthCode));
