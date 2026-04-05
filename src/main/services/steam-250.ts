import axios from "axios";
import type { Steam250Game } from "@types";

interface SteamFeaturedItem {
  id: number;
  name: string;
}

interface SteamFeaturedCategory {
  name: string;
  items: SteamFeaturedItem[];
}

interface SteamFeaturedCategoriesResponse {
  top_sellers?: SteamFeaturedCategory;
  new_releases?: SteamFeaturedCategory;
  specials?: SteamFeaturedCategory;
  coming_soon?: SteamFeaturedCategory;
}

export const getSteam250List = async (): Promise<Steam250Game[]> => {
  try {
    const response = await axios.get<SteamFeaturedCategoriesResponse>(
      "https://store.steampowered.com/api/featuredcategories/",
      { timeout: 15_000 }
    );

    const data = response.data;
    const categories = [
      data.top_sellers,
      data.new_releases,
      data.specials,
      data.coming_soon,
    ].filter(Boolean) as SteamFeaturedCategory[];

    const gamesMap = new Map<string, Steam250Game>();

    for (const category of categories) {
      for (const item of category.items ?? []) {
        const objectId = String(item.id);
        if (!gamesMap.has(objectId)) {
          gamesMap.set(objectId, {
            title: item.name,
            objectId,
          });
        }
      }
    }

    return [...gamesMap.values()];
  } catch (_err) {
    return [];
  }
};
