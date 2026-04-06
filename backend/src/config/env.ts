import dotenv from "dotenv";

dotenv.config();

function requireEnv(key: string, fallback?: string): string {
  const value = process.env[key] ?? fallback;
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
}

export const env = {
  port: Number(process.env.PORT || 3001),
  mongoUri: requireEnv("MONGODB_URI"),
  mongoDbName: process.env.MONGO_DB_NAME || "voice_ai_observability",
  highlevelClientId: requireEnv("HIGHLEVEL_CLIENT_ID"),
  highlevelClientSecret: requireEnv("HIGHLEVEL_CLIENT_SECRET"),
  highlevelRedirectUri: requireEnv("HIGHLEVEL_REDIRECT_URI"),
  highlevelTokenUrl:
    process.env.HIGHLEVEL_TOKEN_URL || "https://services.leadconnectorhq.com/oauth/token",
  highlevelApiBaseUrl:
    process.env.HIGHLEVEL_API_BASE_URL || "https://services.leadconnectorhq.com",
  openaiApiKey: requireEnv("OPENAI_API_KEY"),
  openaiModel: process.env.OPENAI_MODEL || "gpt-4.1-mini",
  openaiApiBaseUrl: process.env.OPENAI_API_BASE_URL || "https://api.openai.com/v1",
  frontendSuccessUrl: process.env.FRONTEND_SUCCESS_URL || "http://localhost:5173/auth/success",
  frontendFailureUrl: process.env.FRONTEND_FAILURE_URL || "http://localhost:5173/auth/error"
};