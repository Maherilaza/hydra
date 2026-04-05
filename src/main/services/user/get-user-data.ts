import { User, type ProfileVisibility, type UserDetails } from "@types";
import { logger } from "../logger";
import { db } from "@main/level";
import { levelKeys } from "@main/level/sublevels";

export const getUserData = async (): Promise<UserDetails | null> => {
  try {
    const user = await db.get<string, User>(levelKeys.user, {
      valueEncoding: "json",
    });

    if (!user) return null;

    return {
      id: user.id,
      username: user.displayName,
      displayName: user.displayName,
      profileImageUrl: user.profileImageUrl,
      backgroundImageUrl: user.backgroundImageUrl,
      email: null,
      profileVisibility: "PUBLIC" as ProfileVisibility,
      bio: "",
      workwondersJwt: "",
      subscription: user.subscription ?? null,
      karma: 0,
      quirks: { backupsPerGameLimit: 0 },
    };
  } catch (error) {
    logger.error("Failed to read user from DB", error);
    return null;
  }
};
