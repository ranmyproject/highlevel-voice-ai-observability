import { Router } from "express";

import { verifyHighLevelLocation } from "../controllers/authController.js";
import { exchangeOAuthCode } from "../controllers/oauthController.js";
import { asyncHandler } from "../handlers/asyncHandler.js";

export const authRouter = Router();

// App context / initial verification
authRouter.post("/auth/verify", asyncHandler(verifyHighLevelLocation));

// OAuth flow
authRouter.post("/oauth/exchange", asyncHandler(exchangeOAuthCode));
