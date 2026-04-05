import { registerEvent } from "../register-event";
import { downloadSourcesSublevel } from "@main/level";
import type { DownloadSource } from "@types";
import { logger } from "@main/services";
import { randomUUID } from "crypto";

const addDownloadSource = async (
  _event: Electron.IpcMainInvokeEvent,
  url: string
) => {
  try {
    const existingSources = await downloadSourcesSublevel.values().all();
    const urlExists = existingSources.some((source) => source.url === url);

    if (urlExists) {
      throw new Error("Download source with this URL already exists");
    }

    // Create download source locally without API call
    const downloadSource: DownloadSource = {
      id: randomUUID(),
      name: new URL(url).hostname || "Custom Source",
      url,
      status: "ACTIVE",
      downloadCount: 0,
      createdAt: new Date().toISOString(),
    };

    await downloadSourcesSublevel.put(downloadSource.id, {
      ...downloadSource,
      isRemote: false, // Local source, not from API
      createdAt: new Date().toISOString(),
    });

    logger.log(`Added local download source: ${downloadSource.url}`);

    return downloadSource;
  } catch (error) {
    logger.error("Failed to add download source:", error);
    throw error;
  }
};

registerEvent("addDownloadSource", addDownloadSource);
