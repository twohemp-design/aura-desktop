import { autoUpdater } from "electron-updater";
import { app, type BrowserWindow } from "electron";
import fs from "node:fs";
import path from "node:path";
import { log } from "./logger";

export type AuraUpdateStatus = {
  checking: boolean;
  lastError: string | null;
  updateAvailable: boolean;
  updateDownloaded: boolean;
  version: string | null;
};

const status: AuraUpdateStatus = {
  checking: false,
  lastError: null,
  updateAvailable: false,
  updateDownloaded: false,
  version: null,
};

let configured = false;

const emitStatus = (window: BrowserWindow | null) => {
  window?.webContents.send("aura:updates:status", { ...status });
};

export const configureUpdater = (getWindow: () => BrowserWindow | null) => {
  if (configured) {
    return;
  }

  configured = true;
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("checking-for-update", () => {
    status.checking = true;
    status.lastError = null;
    emitStatus(getWindow());
    log("info", "[updates] checking for update");
  });

  autoUpdater.on("update-available", (info) => {
    status.checking = false;
    status.updateAvailable = true;
    status.version = info.version;
    emitStatus(getWindow());
    log("info", "[updates] update available", info.version);
  });

  autoUpdater.on("update-not-available", () => {
    status.checking = false;
    status.updateAvailable = false;
    emitStatus(getWindow());
    log("info", "[updates] no update available");
  });

  autoUpdater.on("update-downloaded", (info) => {
    status.updateDownloaded = true;
    status.version = info.version;
    emitStatus(getWindow());
    log("info", "[updates] update downloaded", info.version);
  });

  autoUpdater.on("error", (error) => {
    status.checking = false;
    status.lastError = error.message;
    emitStatus(getWindow());
    log("error", "[updates] update error", error);
  });
};

export const getUpdateStatus = () => ({ ...status });

const hasPackagedUpdateFeed = () => {
  if (!app.isPackaged) {
    return Boolean(process.env.AURA_UPDATE_URL);
  }

  return fs.existsSync(path.join(process.resourcesPath, "app-update.yml"));
};

const waitForUpdateDownloaded = () => new Promise<void>((resolve, reject) => {
  const cleanup = () => {
    autoUpdater.off("update-downloaded", handleDownloaded);
    autoUpdater.off("error", handleError);
  };

  const handleDownloaded = () => {
    cleanup();
    resolve();
  };

  const handleError = (error: Error) => {
    cleanup();
    reject(error);
  };

  autoUpdater.once("update-downloaded", handleDownloaded);
  autoUpdater.once("error", handleError);
});

export const runStartupUpdateFlow = async (onStage: (stage: "checking" | "downloading" | "installing" | "starting") => void) => {
  onStage("checking");

  if (!hasPackagedUpdateFeed()) {
    log("info", "[updates] no packaged update feed configured; skipping startup update check");
    onStage("starting");
    return "skipped" as const;
  }

  try {
    const result = await autoUpdater.checkForUpdates();

    if (!result?.updateInfo || !status.updateAvailable) {
      onStage("starting");
      return "not-available" as const;
    }

    onStage("downloading");
    const updateDownloaded = waitForUpdateDownloaded();
    await autoUpdater.downloadUpdate();
    await updateDownloaded;

    onStage("installing");
    log("info", "[updates] installing downloaded update");
    autoUpdater.quitAndInstall(false, true);

    return "installing" as const;
  } catch (error) {
    status.checking = false;
    status.lastError = error instanceof Error ? error.message : "Unknown startup update error";
    log("error", "[updates] startup update flow failed", error);
    onStage("starting");

    return "failed" as const;
  }
};

export const checkForUpdates = async () => {
  status.checking = true;
  status.lastError = null;

  try {
    await autoUpdater.checkForUpdates();
  } catch (error) {
    status.checking = false;
    status.lastError = error instanceof Error ? error.message : "Unknown update error";
    log("error", "[updates] check failed", error);
  }

  return getUpdateStatus();
};

export const downloadUpdate = async () => {
  try {
    await autoUpdater.downloadUpdate();
  } catch (error) {
    status.lastError = error instanceof Error ? error.message : "Unknown update download error";
    log("error", "[updates] download failed", error);
  }

  return getUpdateStatus();
};

export const quitAndInstall = () => {
  autoUpdater.quitAndInstall(false, true);
};
