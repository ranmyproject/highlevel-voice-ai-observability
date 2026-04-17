import { createHmac, timingSafeEqual } from "crypto";

function base64UrlEncode(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function base64UrlDecode<T>(value: string): T {
  return JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as T;
}

export interface JwtClaims {
  [key: string]: unknown;
  iat?: number;
  exp?: number;
}

export function signJwt(
  payload: Record<string, unknown>,
  secret: string,
  expiresInSeconds?: number
): string {
  const header = { alg: "HS256", typ: "JWT" };
  const issuedAt = Math.floor(Date.now() / 1000);
  const body: JwtClaims = { ...payload, iat: issuedAt };

  if (typeof expiresInSeconds === "number") {
    body.exp = issuedAt + expiresInSeconds;
  }

  const encodedHeader = base64UrlEncode(header);
  const encodedBody = base64UrlEncode(body);
  const signature = createHmac("sha256", secret)
    .update(`${encodedHeader}.${encodedBody}`)
    .digest("base64url");

  return `${encodedHeader}.${encodedBody}.${signature}`;
}

export function verifyJwt<T extends JwtClaims>(token: string, secret: string): T {
  const [encodedHeader, encodedBody, encodedSignature] = token.split(".");

  if (!encodedHeader || !encodedBody || !encodedSignature) {
    throw new Error("Invalid JWT format");
  }

  const expectedSignature = createHmac("sha256", secret)
    .update(`${encodedHeader}.${encodedBody}`)
    .digest("base64url");

  const expectedBuffer = Buffer.from(expectedSignature);
  const providedBuffer = Buffer.from(encodedSignature);

  if (
    expectedBuffer.length !== providedBuffer.length ||
    !timingSafeEqual(expectedBuffer, providedBuffer)
  ) {
    throw new Error("Invalid JWT signature");
  }

  const header = base64UrlDecode<{ alg?: string; typ?: string }>(encodedHeader);

  if (header.alg !== "HS256") {
    throw new Error("Unsupported JWT algorithm");
  }

  const claims = base64UrlDecode<T>(encodedBody);

  if (typeof claims.exp === "number" && claims.exp <= Math.floor(Date.now() / 1000)) {
    throw new Error("JWT has expired");
  }

  return claims;
}
