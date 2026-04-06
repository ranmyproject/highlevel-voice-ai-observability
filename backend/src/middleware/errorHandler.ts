import type { NextFunction, Request, Response } from "express";

import { HttpError } from "../errors/HttpError.js";

export function errorHandler(
  error: unknown,
  _request: Request,
  response: Response,
  _next: NextFunction
): void {
  if (error instanceof HttpError) {
    response.status(error.statusCode).json({ message: error.message });
    return;
  }

  console.error("Unhandled request error", error);
  response.status(500).json({ message: "Internal server error" });
}
