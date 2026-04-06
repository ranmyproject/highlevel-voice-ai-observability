import type { Request, Response } from "express";

import { HttpError } from "../errors/HttpError.js";
import { observabilityService } from "../services/observabilityService.js";
import { callService } from "../services/callService.js";
import { agentRepository } from "../repositories/agentRepository.js";
import { callRepository } from "../repositories/callRepository.js";
import { callMonitorRepository } from "../repositories/callMonitorRepository.js";
import { callMonitoringService } from "../services/callMonitoringService.js";
import { authService } from "../services/authService.js";
import type { IngestTranscriptRequestBody } from "../types.js";

function readLocationId(request: Request): string | undefined {
  const value = request.query.locationId;
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function readAgentId(request: Request): string | undefined {
  const value = request.query.agentId;
  return typeof value === "string" && value.length > 0 ? value : undefined;
}


export async function syncCalls(
  request: Request,
  response: Response
): Promise<void> {
  const locationId = readLocationId(request);
  const agentId = readAgentId(request);

  if (!locationId) {
    throw new HttpError(400, "locationId is required for call sync");
  }

  if (!agentId) {
    throw new HttpError(400, "agentId is required for call sync");
  }

  const fetchedCalls = await callService.fetchCalls(locationId, agentId);

  if (fetchedCalls.length === 0) {
    response.json({
      locationId,
      agentId,
      syncedAt: new Date().toISOString(),
      count: 0
    });
    return;
  }

  const fetchedIds = fetchedCalls.map((c) => c.id);
  const existingIds = await callRepository.findExistingIds(locationId, fetchedIds);
  const newCalls = fetchedCalls.filter((c) => !existingIds.has(c.id));

  if (newCalls.length > 0) {
    // Run the monitor gate on each new call immediately at sync time so the
    // decision is persisted and analysis can skip re-evaluation later.
    const tokenRecord = await authService.getValidToken(locationId);
    const agent = await agentRepository.findOne(locationId, agentId);


    if (agent) {
      const monitorDecisions = newCalls.map((call) => {
        const decision = callMonitoringService.evaluateCall(call, agent);
        call.monitor = decision;
        return decision;
      });
      await callRepository.upsertMany(newCalls);
      await callMonitorRepository.upsertMany(monitorDecisions);
    } else {
      await callRepository.upsertMany(newCalls);
    }
  }

  response.json({
    locationId,
    agentId,
    syncedAt: new Date().toISOString(),
    count: newCalls.length
  });
}

export async function listCalls(
  request: Request,
  response: Response
): Promise<void> {
  const result = await callService.listCalls(
    readLocationId(request),
    readAgentId(request)
  );
  response.json(result);
}

export async function analyzeCall(
  request: Request,
  response: Response
): Promise<void> {
  const result = await callService.analyzeCall(
    String(request.params.callId),
    readLocationId(request)
  );
  response.json(result);
}

export async function analyzeAgentCalls(
  request: Request,
  response: Response
): Promise<void> {
  const result = await callService.analyzeAgentCalls(
    String(request.params.agentId),
    readLocationId(request)
  );
  response.json(result);
}

export async function getAgentWorkspace(
  request: Request,
  response: Response
): Promise<void> {
  const result = await callService.buildAgentWorkspace(
    String(request.params.agentId),
    readLocationId(request)
  );
  response.json(result);
}

export async function synthesizeAgentInsights(
  request: Request,
  response: Response
): Promise<void> {
  const result = await callService.synthesizeAgentInsights(
    String(request.params.agentId),
    readLocationId(request)
  );
  response.json(result);
}

export async function ingestCall(
  request: Request<any, any, IngestTranscriptRequestBody>,
  response: Response
): Promise<void> {
  try {
    const locationId = readLocationId(request);

    if (!locationId) {
      throw new HttpError(400, "locationId is required for call ingestion");
    }

    const result = await observabilityService.ingestTranscript(locationId, request.body);
    response.status(201).json(result);
  } catch (error: unknown) {
    if (error instanceof Error && error.message === "Unknown agentId for this location") {
      throw new HttpError(400, error.message);
    }

    if (
      error instanceof Error &&
      error.message === "caller, transcript, and numeric durationSec are required"
    ) {
      throw new HttpError(400, error.message);
    }

    throw error;
  }
}
