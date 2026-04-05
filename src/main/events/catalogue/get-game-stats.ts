import type { GameShop } from "@types";
import { registerEvent } from "../register-event";

const getGameStats = async (
  _event: Electron.IpcMainInvokeEvent,
  _objectId: string,
  _shop: GameShop
) => {
  return null;
};

registerEvent("getGameStats", getGameStats);
