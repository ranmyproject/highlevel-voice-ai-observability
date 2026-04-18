import type { Request, Response } from "express";

import { env } from "../config/env.js";
import { authService } from "../services/authService.js";
import { signJwt } from "../utils/jwt.js";
import { logger } from "../utils/logger.js";

/**
 * POST /oauth/exchange
 * Used by the frontend to programmatically exchange a code for tokens (legacy flow).
 */
export async function exchangeOAuthCode(
  request: Request,
  response: Response
): Promise<void> {
  const code = typeof request.body.code === "string" ? request.body.code : "";
  const userType = typeof request.body.userType === "string" ? request.body.userType : "Location";

  if (!code) {
    response.status(400).json({ message: "Missing code" });
    return;
  }

  const tokenRecord = await authService.exchangeCodeForTokens(code, userType);

  const token = signJwt({
    locationId: tokenRecord.locationId,
    companyId: tokenRecord.companyId,
  }, env.jwtSecret, 60 * 60 * 24);

  response.json({
    locationId: tokenRecord.locationId || "",
    companyId: tokenRecord.companyId || "",
    token
  });
}

