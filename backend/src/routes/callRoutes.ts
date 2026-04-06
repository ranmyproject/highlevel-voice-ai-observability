import { Router } from "express";

import {
  analyzeCall,
  ingestCall,
  listCalls,
  syncCalls
} from "../controllers/callController.js";
import { asyncHandler } from "../handlers/asyncHandler.js";

export const callRouter = Router();

callRouter.get("/", asyncHandler(listCalls));
callRouter.post("/sync", asyncHandler(syncCalls));
callRouter.post("/ingest", asyncHandler(ingestCall));
callRouter.post(
  "/:callId/analyze",
  asyncHandler(analyzeCall)
);
