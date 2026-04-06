import { createApp } from "../src/app.js";
import { connectToDatabase } from "../src/config/database.js";
import { bootstrapDatabase } from "../src/config/bootstrap.js";

const app = createApp();

let dbInitPromise: Promise<void> | null = null;

async function initDb() {
  if (!dbInitPromise) {
    dbInitPromise = (async () => {
      await connectToDatabase();
      await bootstrapDatabase();
    })();
  }
  return dbInitPromise;
}

// Middleware to ensure the database is connected before handling requests
app.use(async (req, res, next) => {
  try {
    await initDb();
    next();
  } catch (error) {
    next(error);
  }
});

export default app;
