import type { Collection } from "mongodb";

import { getDatabase } from "../config/database.js";
import type { CallMonitorDecision } from "../types.js";

class HighLevelCallMonitorRepository {
  private async getCollection(): Promise<Collection<CallMonitorDecision>> {
    const database = await getDatabase();
    return database.collection<CallMonitorDecision>("call_monitors");
  }

  async upsertMany(decisions: CallMonitorDecision[]): Promise<void> {
    if (decisions.length === 0) {
      return;
    }

    const collection = await this.getCollection();

    await Promise.all(
      decisions.map((decision) =>
        collection.updateOne(
          { callId: decision.callId, locationId: decision.locationId },
          { $set: decision },
          { upsert: true }
        )
      )
    );
  }

  async findOne(locationId: string, callId: string): Promise<CallMonitorDecision | null> {
    const collection = await this.getCollection();
    return collection.findOne({ locationId, callId }, { projection: { _id: 0 } });
  }

  async findByAgentId(locationId: string, agentId: string): Promise<CallMonitorDecision[]> {
    const collection = await this.getCollection();
    return collection
      .find({ locationId, agentId }, { projection: { _id: 0 } })
      .sort({ evaluatedAt: -1 })
      .toArray();
  }
}

export const callMonitorRepository = new HighLevelCallMonitorRepository();
