import { registerEvent } from "../register-event";
import type { GameArtifact, GameShop } from "@types";
import { CloudSync } from "@main/services";
import path from "node:path";
import fs from "node:fs";

const toggleArtifactFreeze = async (
  _event: Electron.IpcMainInvokeEvent,
  objectId: string,
  shop: GameShop,
  gameArtifactId: string,
  freeze: boolean
) => {
  const savesDir = CloudSync.getGameSavesDir(shop, objectId);
  const jsonPath = path.join(savesDir, `${gameArtifactId}.json`);

  if (!fs.existsSync(jsonPath)) {
    throw new Error(`Artifact metadata not found: ${jsonPath}`);
  }

  const raw = await fs.promises.readFile(jsonPath, "utf8");
  const metadata = JSON.parse(raw) as GameArtifact;
  metadata.isFrozen = freeze;
  metadata.updatedAt = new Date().toISOString();

  await fs.promises.writeFile(jsonPath, JSON.stringify(metadata, null, 2), "utf8");
  return metadata;
};

registerEvent("toggleArtifactFreeze", toggleArtifactFreeze);
