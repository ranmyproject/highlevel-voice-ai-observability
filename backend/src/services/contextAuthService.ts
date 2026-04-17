import { env } from "../config/env.js";
import { signJwt, verifyJwt } from "../utils/jwt.js";

interface HighLevelContextClaims {
  locationId?: string;
  companyId?: string;
  userId?: string;
  [key: string]: unknown;
}

class HighLevelContextAuthService {
  verifyHighLevelContextToken(token: string): HighLevelContextClaims {
    if (!env.highlevelContextSecret) {
      throw new Error("HighLevel context secret is not configured");
    }

    return verifyJwt<HighLevelContextClaims>(token, env.highlevelContextSecret);
  }

  issueAppJwt(payload: {
    locationId: string;
    companyId?: string;
    userId?: string;
  }): string {
    return signJwt(
      {
        locationId: payload.locationId,
        companyId: payload.companyId,
        userId: payload.userId,
        scope: "highlevel-location"
      },
      env.jwtSecret,
      60 * 60 * 24
    );
  }
}

export const contextAuthService = new HighLevelContextAuthService();
