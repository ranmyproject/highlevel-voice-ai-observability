import { Router } from "express";

import {
  getAgent,
  getAgentAnalysis,
  listAgents,
  syncAgents
} from "../controllers/agentController.js";
import {
  analyzeAgentCalls,
  getAgentWorkspace,
  synthesizeAgentInsights
} from "../controllers/callController.js";
import { asyncHandler } from "../handlers/asyncHandler.js";

export const agentRouter = Router();

agentRouter.get("/", asyncHandler(listAgents));
agentRouter.post("/sync", asyncHandler(syncAgents));
agentRouter.get("/:agentId", asyncHandler(getAgent));
agentRouter.get("/:agentId/analysis", asyncHandler(getAgentAnalysis));

// Call-based analysis for specific agents
agentRouter.post("/:agentId/analyze", asyncHandler(analyzeAgentCalls));
agentRouter.get("/:agentId/workspace", asyncHandler(getAgentWorkspace));
agentRouter.post("/:agentId/synthesize", asyncHandler(synthesizeAgentInsights));
