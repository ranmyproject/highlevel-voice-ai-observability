import type { Collection } from "mongodb";

import { getDatabase } from "../config/database.js";
import type { AgentFeedbackCycle } from "../types.js";

class AgentFeedbackCycleRepository {
  private async getCollection(): Promise<Collection<AgentFeedbackCycle>> {
    const database = await getDatabase();
    return database.collection<AgentFeedbackCycle>("agent_feedback_cycles");
  }

  async upsert(cycle: AgentFeedbackCycle): Promise<void> {
    const collection = await this.getCollection();
    await collection.updateOne(
      { locationId: cycle.locationId, agentId: cycle.agentId },
      { $set: cycle },
      { upsert: true }
    );
  }

  async findLatest(locationId: string, agentId: string): Promise<AgentFeedbackCycle | null> {
    const collection = await this.getCollection();
    return collection.findOne({ locationId, agentId }, { projection: { _id: 0 } });
  }
}

export const agentFeedbackCycleRepository = new AgentFeedbackCycleRepository();
