import { downloadSourcesSublevel, downloadSourceDataSublevel } from "@main/level";
import { v4 as uuidv4 } from "uuid";
import axios from "axios";
import type { DownloadSourceDownload } from "@types";
import { logger } from "@main/services/logger";

export const migrateDownloadSources = async () => {
  const downloadSources = downloadSourcesSublevel.iterator();

  for await (const [key, value] of downloadSources) {
    // Sources that don't have a proper UUID-style id need migration
    if (!value.isRemote) {
      const newId = uuidv4();

      // Fetch JSON data for this source
      try {
        const response = await axios.get<DownloadSourceDownload[]>(value.url, {
          timeout: 30_000,
        });
        const data = response.data;
        if (Array.isArray(data)) {
          await downloadSourceDataSublevel.put(newId, data);
        }
      } catch (error) {
        logger.error(`Failed to fetch data for migrated source ${value.url}:`, error);
      }

      await downloadSourcesSublevel.put(newId, {
        ...value,
        id: newId,
        downloadCount: 0,
      });

      await downloadSourcesSublevel.del(key);
    }
  }
};
