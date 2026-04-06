import type { Collection } from "mongodb";

import { getDatabase } from "../config/database.js";
import type { TranscriptEvaluation } from "../types.js";

class CallEvaluationRepository {
  private async getCollection(): Promise<Collection<TranscriptEvaluation>> {
    const database = await getDatabase();
    return database.collection<TranscriptEvaluation>("call_evaluations");
  }

  async upsert(evaluation: TranscriptEvaluation): Promise<void> {
    const collection = await this.getCollection();
    await collection.updateOne(
      { callId: evaluation.callId, locationId: evaluation.locationId },
      { $set: evaluation },
      { upsert: true }
    );
  }

  async findByCallId(locationId: string, callId: string): Promise<TranscriptEvaluation | null> {
    const collection = await this.getCollection();
    return collection.findOne({ locationId, callId }, { projection: { _id: 0 } });
  }

  async findByAgentId(locationId: string, agentId: string): Promise<TranscriptEvaluation[]> {
    const collection = await this.getCollection();
    return collection
      .find({ locationId, agentId }, { projection: { _id: 0 } })
      .sort({ evaluatedAt: -1 })
      .toArray();
  }
}

export const callEvaluationRepository = new CallEvaluationRepository();
