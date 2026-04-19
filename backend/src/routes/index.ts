import { Router } from "express";

import { extractLocation } from "../middleware/location.js";
import { agentRouter } from "./agentRoutes.js";
import { authRouter } from "./authRoutes.js";
import { callRouter } from "./callRoutes.js";
import { dashboardRouter } from "./dashboardRoutes.js";
import { healthRouter } from "./healthRoutes.js";
import { webhookRouter } from "./webhookRoutes.js";

export const apiRouter = Router();

// Public routes — no auth required
apiRouter.use(healthRouter);
apiRouter.use(authRouter);
apiRouter.use("/webhooks", webhookRouter);

// Protected routes — locationId required in header
apiRouter.use(extractLocation);
apiRouter.use(dashboardRouter);
apiRouter.use("/agents", agentRouter);
apiRouter.use("/calls", callRouter);
