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

  async findByCompanyId(companyId: string): Promise<InstallationTokenRecord | null> {
    const collection = await this.getCollection();

    return collection.findOne(
      { companyId },
      {
        projection: { _id: 0 },
        sort: { updatedAt: -1 } // In case they refreshed or have multiple tokens
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

  async findLatestAgencyToken(): Promise<InstallationTokenRecord | null> {
    const collection = await this.getCollection();

    return collection.findOne(
      { userType: "Company" },
      {
        projection: { _id: 0 },
        sort: { updatedAt: -1 }
      }
    );
  }

  async deleteByLocationId(locationId: string): Promise<void> {
    const collection = await this.getCollection();
    await collection.deleteMany({ locationId });
  }

  async deleteByCompanyId(companyId: string): Promise<void> {
    const collection = await this.getCollection();
    await collection.deleteMany({ companyId });
  }
}

export const tokenRepository = new HighLevelTokenRepository();
