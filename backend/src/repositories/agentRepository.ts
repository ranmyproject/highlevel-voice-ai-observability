import type { Collection } from "mongodb";

import { getDatabase } from "../config/database.js";
import type {
  AgentAggregates,
  AgentFeedbackCycle,
  AgentRecommendation,
  StoredAgent
} from "../types.js";

class AgentRepository {
  private async getCollection(): Promise<Collection<StoredAgent>> {
    const database = await getDatabase();
    return database.collection<StoredAgent>("voice_agents");
  }

  async upsertMany(agents: StoredAgent[]): Promise<void> {
    if (agents.length === 0) {
      return;
    }

    const collection = await this.getCollection();

    await Promise.all(
      agents.map((agent) =>
        collection.updateOne(
          {
            id: agent.id,
            locationId: agent.locationId
          },
          { $set: agent },
          { upsert: true }
        )
      )
    );
  }

  async findByLocationId(locationId: string): Promise<StoredAgent[]> {
    const collection = await this.getCollection();

    return collection
      .find({ locationId }, { projection: { _id: 0 } })
      .sort({ lastUpdatedAt: -1, syncedAt: -1, name: 1 })
      .toArray();
  }

  async findOne(locationId: string, agentId: string): Promise<StoredAgent | null> {
    const collection = await this.getCollection();
    return collection.findOne({ locationId, id: agentId }, { projection: { _id: 0 } });
  }

  async setAggregates(
    locationId: string,
    agentId: string,
    aggregates: AgentAggregates
  ): Promise<void> {
    const collection = await this.getCollection();
    await collection.updateOne(
      { locationId, id: agentId },
      { $set: { aggregates } }
    );
  }

  async setRecommendations(
    locationId: string,
    agentId: string,
    recommendations: AgentRecommendation[]
  ): Promise<void> {
    const collection = await this.getCollection();
    await collection.updateOne(
      { locationId, id: agentId },
      { $set: { recommendations } }
    );
  }

  async setLastCallSyncedAt(
    locationId: string,
    agentId: string,
    lastCallSyncedAt: string
  ): Promise<void> {
    const collection = await this.getCollection();
    await collection.updateOne(
      { locationId, id: agentId },
      { $set: { lastCallSyncedAt } }
    );
  }

  async setLatestFeedbackCycle(
    locationId: string,
    agentId: string,
    latestFeedbackCycle: AgentFeedbackCycle
  ): Promise<void> {
    const collection = await this.getCollection();
    await collection.updateOne({ locationId, id: agentId }, { $set: { latestFeedbackCycle } });
  }
}

export const agentRepository = new AgentRepository();
