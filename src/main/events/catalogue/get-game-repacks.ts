import { registerEvent } from "../register-event";
import type { GameRepack, GameShop } from "@types";
import { downloadSourceDataSublevel, downloadSourcesSublevel, gamesShopAssetsSublevel, levelKeys } from "@main/level";
import { getSteamAppDetails } from "@main/services";

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .replace(/\s+/g, "");
}

const getGameRepacks = async (
  _event: Electron.IpcMainInvokeEvent,
  objectId: string,
  shop: GameShop
): Promise<GameRepack[]> => {
  if (shop === "custom") return [];

  // Get the game title to match against download sources
  const cacheKey = levelKeys.game(shop, objectId);
  const cachedAssets = await gamesShopAssetsSublevel.get(cacheKey);
  let gameTitle = cachedAssets?.title ?? "";

  if (!gameTitle && shop === "steam") {
    const details = await getSteamAppDetails(objectId, "english");
    gameTitle = details?.name ?? "";
  }

  if (!gameTitle) return [];

  const normalizedGameTitle = normalizeTitle(gameTitle);
  const repacks: GameRepack[] = [];

  const sources = await downloadSourcesSublevel.values().all();

  for (const source of sources) {
    try {
      const data = await downloadSourceDataSublevel.get(source.id);
      if (!data || !Array.isArray(data)) continue;

      for (const entry of data) {
        if (!entry.title) continue;
        if (normalizeTitle(entry.title) === normalizedGameTitle) {
          repacks.push({
            id: `${source.id}:${entry.title}`,
            title: entry.title,
            fileSize: entry.fileSize ?? null,
            uris: entry.uris ?? [],
            unavailableUris: [],
            uploadDate: entry.uploadDate ?? null,
            downloadSourceId: source.id,
            downloadSourceName: source.name,
            createdAt: new Date().toISOString(),
          });
        }
      }
    } catch (_err) {
      /* skip sources with no cached data */
    }
  }

  return repacks;
};

registerEvent("getGameRepacks", getGameRepacks);
