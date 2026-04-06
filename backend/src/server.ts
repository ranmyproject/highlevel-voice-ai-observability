import { createApp } from "./app.js";
import { connectToDatabase } from "./config/database.js";
import { env } from "./config/env.js";

async function startServer(): Promise<void> {
  await connectToDatabase();

  const app = createApp();

  app.listen(env.port, () => {
    console.log(`Voice AI observability backend running on http://localhost:${env.port}`);
  });
}

startServer().catch((error: unknown) => {
  console.error("Failed to start backend", error);
  process.exit(1);
});
