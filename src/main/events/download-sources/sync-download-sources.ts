import { registerEvent } from "../register-event";
import { downloadSourcesSublevel, downloadSourceDataSublevel } from "@main/level";
import type { DownloadSourceDownload } from "@types";
import { logger } from "@main/services";
import axios from "axios";
import { DownloadSourceStatus } from "@shared";

const syncDownloadSources = async (_event: Electron.IpcMainInvokeEvent) => {
  const downloadSources = await downloadSourcesSublevel.values().all();

  for (const source of downloadSources) {
    try {
      const response = await axios.get<DownloadSourceDownload[]>(source.url, {
        timeout: 30_000,
      });
      const data = response.data;
      if (!Array.isArray(data)) continue;

      const fingerprint = String(data.length);
      await downloadSourcesSublevel.put(source.id, {
        ...source,
        downloadCount: data.length,
        fingerprint,
        status: DownloadSourceStatus.Matched,
      });
      await downloadSourceDataSublevel.put(source.id, data);
    } catch (error) {
      logger.error(`Failed to sync download source ${source.url}:`, error);
      await downloadSourcesSublevel.put(source.id, {
        ...source,
        status: DownloadSourceStatus.Failed,
      });
    }
  }
};

registerEvent("syncDownloadSources", syncDownloadSources);
