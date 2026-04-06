import { MongoClient, type Db } from "mongodb";

import { env } from "./env.js";

let client: MongoClient | null = null;
let database: Db | null = null;

export async function connectToDatabase(): Promise<Db> {
  if (database) {
    return database;
  }

  client = new MongoClient(env.mongoUri);
  await client.connect();
  database = client.db(env.mongoDbName);

  return database;
}

export async function getDatabase(): Promise<Db> {
  if (database) {
    return database;
  }

  return connectToDatabase();
}
