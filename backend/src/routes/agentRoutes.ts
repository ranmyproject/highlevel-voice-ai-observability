import { Router } from "express";

import {
  getAgent,
  getAgentAnalysis,
  listAgents,
  syncAgents,
  applyRecommendation,
  applyRecommendations
} from "../controllers/agentController.js";
import {
  analyzeAgentCalls
} from "../controllers/callController.js";
import { asyncHandler } from "../handlers/asyncHandler.js";

export const agentRouter = Router();

agentRouter.get("/", asyncHandler(listAgents));
agentRouter.post("/sync", asyncHandler(syncAgents));
agentRouter.get("/:agentId", asyncHandler(getAgent));
//agentRouter.get("/:agentId/analysis", asyncHandler(getAgentAnalysis));

// Call-based analysis for specific agents
agentRouter.post("/:agentId/analyze", asyncHandler(analyzeAgentCalls));

// Apply a prompt-type recommendation directly to the HighLevel agent
agentRouter.post("/:agentId/apply-recommendation", asyncHandler(applyRecommendation));
agentRouter.post("/:agentId/apply-recommendations", asyncHandler(applyRecommendations));
