import { Router } from "express";

import { getDashboard } from "../controllers/dashboardController.js";
import { asyncHandler } from "../handlers/asyncHandler.js";

export const dashboardRouter = Router();

dashboardRouter.get("/dashboard", asyncHandler(getDashboard));
