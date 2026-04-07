import { createHmac } from "crypto";
import type { NextFunction, Request, Response } from "express";

import { env } from "../config/env.js";

interface JwtPayload {
  locationId: string;
  companyId: string;
  iat: number;
}

function verifyJwt(token: string): JwtPayload {
  const parts = token.split(".");

  if (parts.length !== 3) {
    throw new Error("Malformed token");
  }

  const [header, body, signature] = parts;
  const expected = createHmac("sha256", env.jwtSecret)
    .update(`${header}.${body}`)
    .digest("base64url");

  if (signature !== expected) {
    throw new Error("Invalid token signature");
  }

  return JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as JwtPayload;
}

export function authenticate(
  request: Request,
  response: Response,
  next: NextFunction
): void {
  const authHeader = request.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    response.status(401).json({ message: "Missing or invalid authorization header" });
    return;
  }

  const token = authHeader.slice(7);

  try {
    const payload = verifyJwt(token);

    if (!payload.locationId) {
      throw new Error("Token missing locationId");
    }

    request.locationId = payload.locationId;
    next();
  } catch {
    response.status(401).json({ message: "Invalid or expired token" });
  }
}
