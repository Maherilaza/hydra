import { db } from "../level";
import type { DownloadSourceDownload } from "@types";

export const downloadSourceDataSublevel = db.sublevel<
  string,
  DownloadSourceDownload[]
>("downloadSourceData", {
  valueEncoding: "json",
});
