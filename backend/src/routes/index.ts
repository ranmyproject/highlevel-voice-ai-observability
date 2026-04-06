import { Router } from "express";

import { agentRouter } from "./agentRoutes.js";
import { callRouter } from "./callRoutes.js";
import { dashboardRouter } from "./dashboardRoutes.js";
import { healthRouter } from "./healthRoutes.js";
import { oauthRouter } from "./oauthRoutes.js";
import { webhookRouter } from "./webhookRoutes.js";

export const apiRouter = Router();

apiRouter.use(healthRouter);
apiRouter.use(dashboardRouter);
apiRouter.use("/agents", agentRouter);
apiRouter.use("/calls", callRouter);
apiRouter.use(oauthRouter);
apiRouter.use(webhookRouter);