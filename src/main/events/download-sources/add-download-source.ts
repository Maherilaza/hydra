import { registerEvent } from "../register-event";
import { downloadSourcesSublevel, downloadSourceDataSublevel } from "@main/level";
import type { DownloadSource, DownloadSourceDownload } from "@types";
import { logger } from "@main/services";
import axios from "axios";
import { v4 as uuidv4 } from "uuid";
import { DownloadSourceStatus } from "@shared";

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

    // Fetch and validate the JSON file locally
    const response = await axios.get<DownloadSourceDownload[]>(url, {
      timeout: 30_000,
    });

    const data = response.data;
    if (!Array.isArray(data)) {
      throw new Error("Download source must be a JSON array");
    }

    const id = uuidv4();
    const name = new URL(url).hostname;
    const fingerprint = String(data.length);

    const downloadSource: DownloadSource = {
      id,
      name,
      url,
      status: DownloadSourceStatus.Matched,
      downloadCount: data.length,
      fingerprint,
      createdAt: new Date().toISOString(),
    };

    await downloadSourcesSublevel.put(id, downloadSource);
    await downloadSourceDataSublevel.put(id, data);

    return downloadSource;
  } catch (error) {
    logger.error("Failed to add download source:", error);
    throw error;
  }
};

registerEvent("addDownloadSource", addDownloadSource);
