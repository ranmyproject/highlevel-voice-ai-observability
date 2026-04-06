import type { Request, Response } from "express";
import { HttpError } from "../errors/HttpError.js";
import { observabilityService } from "../services/observabilityService.js";

function readLocationId(request: Request): string | undefined {
  const value = request.query.locationId;
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export async function getDashboard(request: Request, response: Response): Promise<void> {
  const locationId = readLocationId(request);

  if (!locationId) {
    throw new HttpError(400, "locationId is required for dashboard");
  }

  const dashboard = await observabilityService.getDashboard(locationId);
  response.json(dashboard);
}
