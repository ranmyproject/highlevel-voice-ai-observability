import type { Collection } from "mongodb";

import { getDatabase } from "../config/database.js";
import type { InstallationTokenRecord } from "../types.js";

class HighLevelTokenRepository {
  private async getCollection(): Promise<Collection<InstallationTokenRecord>> {
    const database = await getDatabase();
    return database.collection<InstallationTokenRecord>("auth_tokens");
  }

  async upsert(record: InstallationTokenRecord): Promise<InstallationTokenRecord> {
    const collection = await this.getCollection();
    const filter: Partial<InstallationTokenRecord> = {};

    if (record.locationId) {
      filter.locationId = record.locationId;
    } else if (record.companyId) {
      filter.companyId = record.companyId;
    } else {
      filter.accessToken = record.accessToken;
    }

    await collection.updateOne(filter, { $set: record }, { upsert: true });

    return record;
  }

  async findByLocationId(locationId: string): Promise<InstallationTokenRecord | null> {
    const collection = await this.getCollection();

    return collection.findOne(
      { locationId },
      {
        projection: { _id: 0 }
      }
    );
  }

  async findLatest(): Promise<InstallationTokenRecord | null> {
    const collection = await this.getCollection();

    return collection.findOne(
      {},
      {
        projection: { _id: 0 },
        sort: { updatedAt: -1 }
      }
    );
  }
}

export const tokenRepository = new HighLevelTokenRepository();
