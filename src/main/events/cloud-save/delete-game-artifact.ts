import { registerEvent } from "../register-event";
import type { GameShop } from "@types";
import { CloudSync } from "@main/services";
import path from "node:path";
import fs from "node:fs";

const deleteGameArtifact = async (
  _event: Electron.IpcMainInvokeEvent,
  objectId: string,
  shop: GameShop,
  gameArtifactId: string
) => {
  const savesDir = CloudSync.getGameSavesDir(shop, objectId);
  const tarPath = path.join(savesDir, `${gameArtifactId}.tar`);
  const jsonPath = path.join(savesDir, `${gameArtifactId}.json`);

  if (fs.existsSync(tarPath)) fs.unlinkSync(tarPath);
  if (fs.existsSync(jsonPath)) fs.unlinkSync(jsonPath);
};

registerEvent("deleteGameArtifact", deleteGameArtifact);
