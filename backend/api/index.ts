import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createApp } from "../src/app.js";
import { connectToDatabase } from "../src/config/database.js";

const app = createApp();

let dbReady = false;

async function ensureDb(): Promise<void> {
  if (!dbReady) {
    await connectToDatabase();
    dbReady = true;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await ensureDb();
  return app(req, res);
}
