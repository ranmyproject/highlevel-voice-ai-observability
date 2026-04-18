import type { Request, Response } from "express";
import { HttpError } from "../errors/HttpError.js";
import { authService } from "../services/authService.js";
import { contextAuthService } from "../services/contextAuthService.js";

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

  // Use the high-level auth service to get a valid token.
  // This will automatically handle Agency -> Location token generation and discovery.
  const tokenRecord = await authService.getValidToken(locationId);

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
