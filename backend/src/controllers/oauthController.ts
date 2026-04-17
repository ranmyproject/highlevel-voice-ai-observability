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

  if (!code) {
    response.status(400).json({ message: "Missing code" });
    return;
  }

  const tokenRecord = await authService.exchangeCodeForTokens(code);

  const token = signJwt({
    locationId: tokenRecord.locationId,
    companyId: tokenRecord.companyId,
  }, env.jwtSecret, 60 * 60 * 24);

  response.json({ locationId: tokenRecord.locationId, token });
}

/**
 * GET /oauth/callback
 * GHL redirects here with ?code=...&locationId=... after the user installs the app.
 * We exchange the code, store the token, then redirect the browser to the
 * frontend /installed page which shows a success message and deep-links into GHL.
 */
export async function oauthCallback(
  request: Request,
  response: Response
): Promise<void> {
  const code = typeof request.query.code === "string" ? request.query.code : "";

  if (!code) {
    logger.warn("oauthCallback", "No code in callback query", { query: request.query });
    response.status(400).send("Missing OAuth code");
    return;
  }

  logger.info("oauthCallback", "Received OAuth callback from GHL, exchanging code");

  const tokenRecord = await authService.exchangeCodeForTokens(code);
  const locationId = tokenRecord.locationId ?? "";

  logger.info("oauthCallback", "Token stored, redirecting to installed page", { locationId });

  // Redirect to the frontend success page — it will then deep-link into GHL
  const frontendBase = env.frontendUrl;
  const redirect = `${frontendBase}/installed${locationId ? `?location_id=${locationId}` : ""}`;

  response.redirect(302, redirect);
}
