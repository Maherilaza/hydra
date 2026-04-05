import { registerEvent } from "../register-event";
import type { GameShop } from "@types";
import { CloudSync } from "@main/services";

const getGameArtifacts = async (
  _event: Electron.IpcMainInvokeEvent,
  objectId: string,
  shop: GameShop
) => {
  if (shop === "custom") return [];
  return CloudSync.listLocalArtifacts(shop, objectId);
};

registerEvent("getGameArtifacts", getGameArtifacts);
