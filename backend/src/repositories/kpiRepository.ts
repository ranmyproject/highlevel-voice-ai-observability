import type { Collection } from "mongodb";

import { getDatabase } from "../config/database.js";
import type { StoredKpiBlueprint } from "../types.js";

class KpiRepository {
  private async getCollection(): Promise<Collection<StoredKpiBlueprint>> {
    const database = await getDatabase();
    return database.collection<StoredKpiBlueprint>("agent_kpi_blueprints");
  }

  async upsert(blueprint: StoredKpiBlueprint): Promise<void> {
    const collection = await this.getCollection();
    await collection.updateOne(
      { agentId: blueprint.agentId, locationId: blueprint.locationId },
      { $set: blueprint },
      { upsert: true }
    );
  }

  async findByAgentId(locationId: string, agentId: string): Promise<StoredKpiBlueprint | null> {
    const collection = await this.getCollection();
    return collection.findOne({ locationId, agentId }, { projection: { _id: 0 } });
  }
}

export const kpiRepository = new KpiRepository();
