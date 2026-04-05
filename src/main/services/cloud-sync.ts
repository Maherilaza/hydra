import { levelKeys, gamesSublevel, db } from "@main/level";
import path from "node:path";
import * as tar from "tar";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import type { GameShop, User } from "@types";
import { backupsPath } from "@main/constants";
import { HydraApi } from "./hydra-api";
import { normalizePath, parseRegFile } from "@main/helpers";
import { logger } from "./logger";
import { WindowManager } from "./window-manager";
import axios from "axios";
import { Ludusavi } from "./ludusavi";
import { formatDate, SubscriptionRequiredError } from "@shared";
import i18next, { t } from "i18next";
import { SystemPath } from "./system-path";
import { Wine } from "./wine";

export class CloudSync {
  public static getWindowsLikeUserProfilePath(winePrefixPath?: string | null) {
    if (process.platform === "linux") {
      if (!winePrefixPath) {
        throw new Error("Wine prefix path is required");
      }

      const userReg = fs.readFileSync(
        path.join(winePrefixPath, "user.reg"),
        "utf8"
      );

      const entries = parseRegFile(userReg);
      const volatileEnvironment = entries.find(
        (entry) => entry.path === "Volatile Environment"
      );

      if (!volatileEnvironment) {
        throw new Error("Volatile environment not found in user.reg");
      }

      const { values } = volatileEnvironment;
      const userProfile = String(values["USERPROFILE"]);

      if (userProfile) {
        return normalizePath(userProfile);
      } else {
        throw new Error("User profile not found in user.reg");
      }
    }

    return normalizePath(SystemPath.getPath("home"));
  }

  public static getBackupLabel(automatic: boolean) {
    const language = i18next.language;

    const date = formatDate(new Date(), language);

    if (automatic) {
      return t("automatic_backup_from", {
        ns: "game_details",
        date,
      });
    }

    return t("backup_from", {
      ns: "game_details",
      date,
    });
  }

  private static async bundleBackup(
    shop: GameShop,
    objectId: string,
    winePrefix: string | null
  ) {
    const backupPath = path.join(backupsPath, `${shop}-${objectId}`);

    // Remove existing backup
    if (fs.existsSync(backupPath)) {
      try {
        await fs.promises.rm(backupPath, { recursive: true });
      } catch (error) {
        logger.error("Failed to remove backup path", { backupPath, error });
      }
    }

    await Ludusavi.backupGame(shop, objectId, backupPath, winePrefix);

    const tarLocation = path.join(backupsPath, `${crypto.randomUUID()}.tar`);

    await tar.create(
      {
        gzip: false,
        file: tarLocation,
        cwd: backupPath,
      },
      ["."]
    );

    return tarLocation;
  }

  public static async uploadSaveGame(
    objectId: string,
    shop: GameShop,
    downloadOptionTitle: string | null,
    label?: string
  ) {
    // Subscription check removed - local backups are always available
    const game = await gamesSublevel.get(levelKeys.game(shop, objectId));
    const effectiveWinePrefixPath = Wine.getEffectivePrefixPath(
      game?.winePrefixPath,
      objectId
    );

    const bundleLocation = await this.bundleBackup(
      shop,
      objectId,
      effectiveWinePrefixPath
    );

    const stat = await fs.promises.stat(bundleLocation);

    // Save backup locally instead of uploading to cloud
    const localBackupsDir = path.join(backupsPath, "saved");
    if (!fs.existsSync(localBackupsDir)) {
      await fs.promises.mkdir(localBackupsDir, { recursive: true });
    }

    const backupFileName = `${shop}-${objectId}-${Date.now()}.tar`;
    const localBackupPath = path.join(localBackupsDir, backupFileName);

    // Copy the tar file to the local backups directory
    await fs.promises.copyFile(bundleLocation, localBackupPath);

    logger.log(`Backup saved locally: ${localBackupPath}`);

    // Store backup metadata in a JSON file
    const metadataPath = path.join(localBackupsDir, `${shop}-${objectId}-${Date.now()}.json`);
    await fs.promises.writeFile(
      metadataPath,
      JSON.stringify({
        id: crypto.randomUUID(),
        shop,
        objectId,
        hostname: os.hostname(),
        winePrefixPath: effectiveWinePrefixPath
          ? fs.existsSync(effectiveWinePrefixPath)
            ? fs.realpathSync(effectiveWinePrefixPath)
            : effectiveWinePrefixPath
          : null,
        homeDir: this.getWindowsLikeUserProfilePath(effectiveWinePrefixPath),
        downloadOptionTitle,
        platform: process.platform,
        label: label || this.getBackupLabel(false),
        size: stat.size,
        createdAt: new Date().toISOString(),
        backupFile: backupFileName,
      }, null, 2)
    );

    WindowManager.mainWindow?.webContents.send(
      `on-upload-complete-${objectId}-${shop}`,
      true
    );

    try {
      await fs.promises.unlink(bundleLocation);
    } catch (error) {
      logger.error("Failed to remove temporary tar file", { bundleLocation, error });
    }
  }
}
