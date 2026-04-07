import { createHmac } from "crypto";
import type { Request, Response } from "express";

import { env } from "../config/env.js";
import { authService } from "../services/authService.js";

function createJwt(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify({ ...payload, iat: Math.floor(Date.now() / 1000) })).toString("base64url");
  const sig = createHmac("sha256", env.jwtSecret).update(`${header}.${body}`).digest("base64url");
  return `${header}.${body}.${sig}`;
}

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

  const token = createJwt({
    locationId: tokenRecord.locationId,
    companyId: tokenRecord.companyId,
  });

  response.json({ locationId: tokenRecord.locationId, token });
}
