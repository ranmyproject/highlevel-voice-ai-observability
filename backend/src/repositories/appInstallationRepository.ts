import type { Collection } from "mongodb";

import { getDatabase } from "../config/database.js";
import type { AppInstallationRecord } from "../types.js";

class AppInstallationRepository {
  private async getCollection(): Promise<Collection<AppInstallationRecord>> {
    const database = await getDatabase();
    return database.collection<AppInstallationRecord>("app_installations");
  }

  async upsert(record: AppInstallationRecord): Promise<AppInstallationRecord> {
    const collection = await this.getCollection();
    const filter: Partial<AppInstallationRecord> = {
      appId: record.appId,
      installationScope: record.installationScope
    };

    if (record.locationId) {
      filter.locationId = record.locationId;
    }

    if (record.companyId) {
      filter.companyId = record.companyId;
    }

    await collection.updateOne(
      filter,
      {
        $set: record
      },
      { upsert: true }
    );

    return record;
  }
}

export const appInstallationRepository = new AppInstallationRepository();
