import type { Request, Response } from "express";

import { HttpError } from "../errors/HttpError.js";
import { tokenRepository } from "../repositories/tokenRepository.js";
import { contextAuthService } from "../services/contextAuthService.js";
import { logger } from "../utils/logger.js";

function readContextToken(body: Record<string, unknown>): string {
  const locationId = body.locationId;

  if (typeof locationId === "string" && locationId.length > 0) {
    return locationId;
  }

  throw new HttpError(400, "Missing locationId");
}

export async function verifyHighLevelLocation(
  request: Request,
  response: Response
): Promise<void> {
  const locationId = readContextToken(request.body as Record<string, unknown>);

  const tokenRecord = await tokenRepository.findByLocationId(locationId);

  if (!tokenRecord) {
    logger.warn("verifyHighLevelLocation", "No stored token record found for location", { locationId });
    throw new HttpError(404, "Unknown locationId");
  }

  const appToken = contextAuthService.issueAppJwt({
    locationId,
    companyId: tokenRecord.companyId,
    userId: tokenRecord.userId
  });

  response.json({
    locationId,
    token: appToken,
    tokenType: "Bearer",
    expiresIn: 60 * 60 * 24
  });
}
