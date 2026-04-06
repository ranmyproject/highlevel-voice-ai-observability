import type { Collection } from "mongodb";

import { getDatabase } from "../config/database.js";
import type { Transcript } from "../types.js";

class TranscriptRepository {
  private async getCollection(): Promise<Collection<Transcript>> {
    const database = await getDatabase();
    return database.collection<Transcript>("transcripts");
  }

  async findAll(): Promise<Transcript[]> {
    const collection = await this.getCollection();
    return collection
      .find({}, { projection: { _id: 0 } })
      .sort({ timestamp: -1 })
      .toArray();
  }

  async findByAgentId(agentId: string): Promise<Transcript[]> {
    const collection = await this.getCollection();
    return collection
      .find({ agentId }, { projection: { _id: 0 } })
      .sort({ timestamp: -1 })
      .toArray();
  }

  async create(transcript: Transcript): Promise<Transcript> {
    const collection = await this.getCollection();
    await collection.insertOne(transcript);
    return transcript;
  }

  async seedIfEmpty(transcripts: Transcript[]): Promise<void> {
    const collection = await this.getCollection();
    const existingCount = await collection.countDocuments();

    if (existingCount > 0) {
      return;
    }

    await collection.insertMany(transcripts);
  }
}

export const transcriptRepository = new TranscriptRepository();
