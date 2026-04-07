import { Router } from "express";

import { authenticate } from "../middleware/authenticate.js";
import { agentRouter } from "./agentRoutes.js";
import { callRouter } from "./callRoutes.js";
import { dashboardRouter } from "./dashboardRoutes.js";
import { healthRouter } from "./healthRoutes.js";
import { oauthRouter } from "./oauthRoutes.js";
import { webhookRouter } from "./webhookRoutes.js";

export const apiRouter = Router();

// Public routes — no auth required
apiRouter.use(healthRouter);
apiRouter.use(oauthRouter);
apiRouter.use(webhookRouter);

// Protected routes — JWT required
apiRouter.use(authenticate);
apiRouter.use(dashboardRouter);
apiRouter.use("/agents", agentRouter);
apiRouter.use("/calls", callRouter);