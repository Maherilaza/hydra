import type { GameShop, ShopAssets } from "@types";
import { registerEvent } from "../register-event";
import { gamesShopAssetsSublevel, levelKeys } from "@main/level";
import { getSteamAppDetails } from "@main/services";

const LOCAL_CACHE_EXPIRATION = 1000 * 60 * 60 * 8; // 8 hours

const buildSteamAssets = (objectId: string, title: string): ShopAssets => ({
  objectId,
  shop: "steam",
  title,
  iconUrl: `https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/apps/${objectId}/icon.jpg`,
  libraryHeroImageUrl: `https://shared.steamstatic.com/store_item_assets/steam/apps/${objectId}/library_hero.jpg`,
  libraryImageUrl: `https://shared.steamstatic.com/store_item_assets/steam/apps/${objectId}/header.jpg`,
  logoImageUrl: `https://shared.steamstatic.com/store_item_assets/steam/apps/${objectId}/logo.png`,
  logoPosition: null,
  coverImageUrl: `https://shared.steamstatic.com/store_item_assets/steam/apps/${objectId}/library_600x900_2x.jpg`,
  downloadSources: [],
});

export const getGameAssets = async (objectId: string, shop: GameShop) => {
  if (shop === "custom") {
    return null;
  }

  const cacheKey = levelKeys.game(shop, objectId);
  const cachedAssets = await gamesShopAssetsSublevel.get(cacheKey);

  if (
    cachedAssets &&
    cachedAssets.updatedAt + LOCAL_CACHE_EXPIRATION > Date.now()
  ) {
    return cachedAssets;
  }

  if (shop === "steam") {
    // Get title from Steam API or fall back to cached value
    const title: string =
      cachedAssets?.title ||
      (await getSteamAppDetails(objectId, "english").then(
        (d) => d?.name ?? ""
      )) ||
      "";

    const assets = buildSteamAssets(objectId, title);

    await gamesShopAssetsSublevel.put(cacheKey, {
      ...assets,
      title: cachedAssets?.title || assets.title,
      updatedAt: Date.now(),
    });

    return assets;
  }

  return null;
};

const getGameAssetsEvent = async (
  _event: Electron.IpcMainInvokeEvent,
  objectId: string,
  shop: GameShop
) => {
  return getGameAssets(objectId, shop);
};

registerEvent("getGameAssets", getGameAssetsEvent);
