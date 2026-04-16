import type { NextFunction, Request, Response } from "express";

export function extractLocation(
  request: Request,
  response: Response,
  next: NextFunction
): void {
  const locationId = request.headers["x-location-id"];

  if (!locationId) {
    response.status(400).json({ message: "Missing x-location-id header" });
    return;
  }

  request.locationId = locationId as string;
  next();
}
