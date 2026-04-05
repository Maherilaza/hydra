import { levelKeys, gamesSublevel } from "@main/level";
import path from "node:path";
import * as tar from "tar";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import type { GameArtifact, GameShop } from "@types";
import { backupsPath, gameSavesPath } from "@main/constants";
import { normalizePath, parseRegFile } from "@main/helpers";
import { logger } from "./logger";
import { WindowManager } from "./window-manager";
import { Ludusavi } from "./ludusavi";
import { formatDate, } from "@shared";
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

  public static getGameSavesDir(shop: GameShop, objectId: string) {
    return path.join(gameSavesPath, `${shop}-${objectId}`);
  }

  public static async listLocalArtifacts(
    shop: GameShop,
    objectId: string
  ): Promise<GameArtifact[]> {
    const dir = this.getGameSavesDir(shop, objectId);
    if (!fs.existsSync(dir)) return [];

    const files = await fs.promises.readdir(dir);
    const artifacts: GameArtifact[] = [];

    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      try {
        const raw = await fs.promises.readFile(path.join(dir, file), "utf8");
        artifacts.push(JSON.parse(raw) as GameArtifact);
      } catch (_err) {
        /* skip corrupt metadata */
      }
    }

    return artifacts.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  public static async uploadSaveGame(
    objectId: string,
    shop: GameShop,
    downloadOptionTitle: string | null,
    label?: string
  ) {
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
    const artifactId = crypto.randomUUID();
    const now = new Date().toISOString();

    const savesDir = this.getGameSavesDir(shop, objectId);
    await fs.promises.mkdir(savesDir, { recursive: true });

    const tarDest = path.join(savesDir, `${artifactId}.tar`);
    await fs.promises.rename(bundleLocation, tarDest);

    const metadata: GameArtifact = {
      id: artifactId,
      artifactLengthInBytes: stat.size,
      downloadOptionTitle,
      createdAt: now,
      updatedAt: now,
      hostname: os.hostname(),
      downloadCount: 0,
      label: label ?? undefined,
      isFrozen: false,
    };

    await fs.promises.writeFile(
      path.join(savesDir, `${artifactId}.json`),
      JSON.stringify(metadata, null, 2),
      "utf8"
    );

    WindowManager.mainWindow?.webContents.send(
      `on-upload-complete-${objectId}-${shop}`,
      true
    );
  }
}
