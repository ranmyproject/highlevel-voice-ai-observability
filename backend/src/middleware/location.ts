import type { NextFunction, Request, Response } from "express";

import { env } from "../config/env.js";
import { verifyJwt } from "../utils/jwt.js";

function readBearerToken(authorizationHeader: string | undefined): string | null {
  if (!authorizationHeader) {
    return null;
  }

  const [scheme, token] = authorizationHeader.split(" ");
  if (scheme !== "Bearer" || !token) {
    return null;
  }

  return token;
}

export function extractLocation(
  request: Request,
  response: Response,
  next: NextFunction
): void {
  const bearerToken = readBearerToken(request.headers.authorization);

  if (!bearerToken) {
    response.status(401).json({ message: "Missing authorization token" });
    return;
  }

  try {
    const claims = verifyJwt<{ locationId?: string }>(bearerToken, env.jwtSecret);

    if (!claims.locationId || typeof claims.locationId !== "string") {
      response.status(401).json({ message: "Invalid access token: missing locationId" });
      return;
    }

    request.locationId = claims.locationId;
    next();
  } catch (error) {
    response.status(401).json({
      message: error instanceof Error ? error.message : "Invalid access token"
    });
  }
}
