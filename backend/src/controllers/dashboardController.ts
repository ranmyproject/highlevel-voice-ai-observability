import type { Request, Response } from "express";
import { observabilityService } from "../services/observabilityService.js";

export async function getDashboard(request: Request, response: Response): Promise<void> {
  const dashboard = await observabilityService.getDashboard(request.locationId);
  response.json(dashboard);
}
