import type { Collection } from "mongodb";

import { getDatabase } from "../config/database.js";
import type { StoredVoiceCall } from "../types.js";

class CallRepository {
  private async getCollection(): Promise<Collection<StoredVoiceCall>> {
    const database = await getDatabase();
    return database.collection<StoredVoiceCall>("voice_calls");
  }

  async upsertMany(calls: StoredVoiceCall[]): Promise<void> {
    if (calls.length === 0) {
      return;
    }

    const collection = await this.getCollection();

    await Promise.all(
      calls.map((call) =>
        collection.updateOne(
          { id: call.id, locationId: call.locationId },
          { $set: call },
          { upsert: true }
        )
      )
    );
  }

  async findByLocationId(locationId: string): Promise<StoredVoiceCall[]> {
    const collection = await this.getCollection();

    return collection
      .find({ locationId }, { projection: { _id: 0 } })
      .sort({ lastUpdatedAt: -1, syncedAt: -1 })
      .toArray();
  }

  async findByAgentId(locationId: string, agentId: string): Promise<StoredVoiceCall[]> {
    const collection = await this.getCollection();

    return collection
      .find({ locationId, agentId }, { projection: { _id: 0 } })
      .sort({ lastUpdatedAt: -1, syncedAt: -1 })
      .toArray();
  }

  async findOne(locationId: string, callId: string): Promise<StoredVoiceCall | null> {
    const collection = await this.getCollection();
    return collection.findOne({ locationId, id: callId }, { projection: { _id: 0 } });
  }

  async findExistingIds(locationId: string, ids: string[]): Promise<Set<string>> {
    if (ids.length === 0) return new Set();
    const collection = await this.getCollection();
    const docs = await collection
      .find({ locationId, id: { $in: ids } }, { projection: { _id: 0, id: 1 } })
      .toArray();
    return new Set(docs.map((d) => d.id));
  }
}

export const callRepository = new CallRepository();
