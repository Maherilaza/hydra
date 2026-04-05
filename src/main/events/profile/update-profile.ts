import { registerEvent } from "../register-event";
import fs from "node:fs";
import path from "node:path";
import type { UpdateProfileRequest, UserProfile } from "@types";
import { db, levelKeys } from "@main/level";
import type { User } from "@types";
import { ASSETS_PATH } from "@main/constants";
import { logger } from "@main/services";

const copyImageLocally = async (
  type: "profile-image" | "background-image",
  imagePath: string
): Promise<string | null> => {
  try {
    const dir = path.join(ASSETS_PATH, "profile");
    await fs.promises.mkdir(dir, { recursive: true });
    const ext = path.extname(imagePath);
    const fileName = `${type}${ext}`;
    const destPath = path.join(dir, fileName);
    await fs.promises.copyFile(imagePath, destPath);
    return `file://${destPath}`;
  } catch (error) {
    logger.error(`Failed to copy ${type}:`, error);
    return null;
  }
};

const updateProfile = async (
  _event: Electron.IpcMainInvokeEvent,
  updateProfileData: UpdateProfileRequest
): Promise<UserProfile> => {
  let profileImageUrl: string | null | undefined = undefined;
  let backgroundImageUrl: string | null | undefined = undefined;

  if (updateProfileData.profileImageUrl !== undefined) {
    if (updateProfileData.profileImageUrl === null) {
      profileImageUrl = null;
    } else {
      profileImageUrl = await copyImageLocally(
        "profile-image",
        updateProfileData.profileImageUrl
      );
    }
  }

  if (updateProfileData.backgroundImageUrl !== undefined) {
    if (updateProfileData.backgroundImageUrl === null) {
      backgroundImageUrl = null;
    } else {
      backgroundImageUrl = await copyImageLocally(
        "background-image",
        updateProfileData.backgroundImageUrl
      );
    }
  }

  let user: User | null = null;
  try {
    user = await db.get<string, User>(levelKeys.user, {
      valueEncoding: "json",
    });
  } catch (_err) {
    /* user may not exist yet */
  }

  const updatedUser: User = {
    id: user?.id ?? "local",
    displayName: updateProfileData.displayName ?? user?.displayName ?? "",
    profileImageUrl:
      profileImageUrl !== undefined
        ? profileImageUrl
        : (user?.profileImageUrl ?? null),
    backgroundImageUrl:
      backgroundImageUrl !== undefined
        ? backgroundImageUrl
        : (user?.backgroundImageUrl ?? null),
    subscription: user?.subscription ?? null,
  };

  await db.put<string, User>(levelKeys.user, updatedUser, {
    valueEncoding: "json",
  });

  return {
    id: updatedUser.id,
    displayName: updatedUser.displayName,
    profileImageUrl: updatedUser.profileImageUrl,
    backgroundImageUrl: updatedUser.backgroundImageUrl,
    email: null,
    profileVisibility: "PUBLIC",
    bio: updateProfileData.bio ?? "",
    libraryGames: [],
    recentGames: [],
    friends: [],
    totalFriends: 0,
    relation: null,
    currentGame: null,
    hasActiveSubscription: false,
    karma: 0,
    quirks: { backupsPerGameLimit: 0 },
    badges: [],
    hasCompletedWrapped2025: false,
  };
};

registerEvent("updateProfile", updateProfile);
