import type { Request, Response } from "express";

import { env } from "../config/env.js";
import { authService } from "../services/authService.js";

function buildRedirectUrl(baseUrl: string, params: Record<string, string | undefined>): string {
  const url = new URL(baseUrl);

  for (const [key, value] of Object.entries(params)) {
    if (value) {
      url.searchParams.set(key, value);
    }
  }

  return url.toString();
}

export async function handleHighLevelOAuthCallback(
  request: Request,
  response: Response
): Promise<void> {
  const code = typeof request.query.code === "string" ? request.query.code : "";
  const error = typeof request.query.error === "string" ? request.query.error : "";

  console.log(code);

  if (error) {
    response.redirect(
      buildRedirectUrl(env.frontendFailureUrl, {
        error
      })
    );
    return;
  }

  if (!code) {
    response.redirect(
      buildRedirectUrl(env.frontendFailureUrl, {
        error: "missing_code"
      })
    );
    return;
  }

  console.log(code);

  try {
    const tokenRecord = await authService.exchangeCodeForTokens(code);

    response.redirect(
      buildRedirectUrl(env.frontendSuccessUrl, {
        locationId: tokenRecord.locationId,
        companyId: tokenRecord.companyId,
        status: "connected"
      })
    );
  } catch (callbackError: unknown) {
    const message =
      callbackError instanceof Error ? callbackError.message : "oauth_callback_failed";

    response.redirect(
      buildRedirectUrl(env.frontendFailureUrl, {
        error: message
      })
    );
  }
}
