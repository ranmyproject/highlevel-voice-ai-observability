import { Router } from "express";

import { verifyHighLevelLocation } from "../controllers/authController.js";
import { asyncHandler } from "../handlers/asyncHandler.js";

export const authRouter = Router();

authRouter.post("/auth/verify", asyncHandler(verifyHighLevelLocation));
authRouter.post("/auth/highlevel/context", asyncHandler(verifyHighLevelLocation));
