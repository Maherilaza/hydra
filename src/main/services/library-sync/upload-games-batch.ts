import { AchievementWatcherManager } from "../achievements/achievement-watcher-manager";
import { WindowManager } from "../window-manager";

export const uploadGamesBatch = async () => {
  AchievementWatcherManager.preSearchAchievements();

  if (WindowManager.mainWindow)
    WindowManager.mainWindow.webContents.send("on-library-batch-complete");
};
