import { Router } from "express";

import { extractLocation } from "../middleware/location.js";
import { agentRouter } from "./agentRoutes.js";
import { authRouter } from "./authRoutes.js";
import { callRouter } from "./callRoutes.js";
import { healthRouter } from "./healthRoutes.js";
import { oauthRouter } from "./oauthRoutes.js";
import { webhookRouter } from "./webhookRoutes.js";

export const apiRouter = Router();

// Public routes — no auth required
apiRouter.use(healthRouter);
apiRouter.use(oauthRouter);
apiRouter.use(authRouter);
apiRouter.use(webhookRouter);

// Protected routes — locationId required in header
apiRouter.use(extractLocation);
// apiRouter.use(dashboardRouter);
apiRouter.use("/agents", agentRouter);
apiRouter.use("/calls", callRouter);
