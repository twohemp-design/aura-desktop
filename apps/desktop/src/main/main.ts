import {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  Notification,
  shell,
  Tray,
} from "electron";
import path from "node:path";
import {
  getLogFilePath,
  initializeLogger,
  log,
  readRecentLog,
} from "./logger";
import {
  getSettingsFilePath,
  readSettings,
  updateSettings,
} from "./settings";
import { configureSecurityPolicy } from "./securityPolicy";
import {
  closeSplashWindow,
  createSplashWindow,
  setSplashStage,
} from "./splashWindow";
import {
  checkForUpdates,
  configureUpdater,
  downloadUpdate,
  getUpdateStatus,
  quitAndInstall,
  runStartupUpdateFlow,
} from "./updater";

const DEFAULT_AURA_URL = "https://aurahub.ru";
const AURA_DESKTOP_URL = process.env.AURA_DESKTOP_URL || DEFAULT_AURA_URL;
const APP_USER_MODEL_ID = "ru.aurahub.desktop";
const DEEP_LINK_PROTOCOL = "aura";

let mainWindow: BrowserWindow | null = null;
let splashWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;
let pendingDeepLink: string | null = null;

const getAssetPath = (...segments: string[]) => {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "assets", ...segments);
  }

  return path.join(__dirname, "../../assets", ...segments);
};

const isAllowedAppUrl = (targetUrl: string) => {
  try {
    const parsedTarget = new URL(targetUrl);
    const parsedAura = new URL(AURA_DESKTOP_URL);

    return parsedTarget.origin === parsedAura.origin;
  } catch {
    return false;
  }
};

const buildAuraUrl = (pathname: string, search = "") => {
  const auraUrl = new URL(AURA_DESKTOP_URL);
  auraUrl.pathname = pathname;
  auraUrl.search = search;
  auraUrl.hash = "";

  return auraUrl.toString();
};

const resolveDeepLinkToAppUrl = (deepLink: string) => {
  try {
    const parsed = new URL(deepLink);

    if (parsed.protocol !== `${DEEP_LINK_PROTOCOL}:`) {
      return null;
    }

    const hostPath = parsed.hostname ? `/${parsed.hostname}` : "";
    const rawPath = `${hostPath}${parsed.pathname || "/"}`;
    const normalizedPath = rawPath.replace(/\/{2,}/g, "/");

    if (!normalizedPath.startsWith("/")) {
      return null;
    }

    return buildAuraUrl(normalizedPath, parsed.search);
  } catch {
    return null;
  }
};

const createMainWindow = async () => {
  Menu.setApplicationMenu(null);

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 980,
    minHeight: 640,
    title: "Aura",
    backgroundColor: "#000000",
    frame: false,
    hasShadow: true,
    thickFrame: false,
    icon: getAssetPath("aura-icon.png"),
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "../preload/preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.once("ready-to-show", () => {
    closeSplashWindow(splashWindow);
    splashWindow = null;
    mainWindow?.show();
  });

  mainWindow.on("close", (event) => {
    const settings = readSettings();

    if (isQuitting || process.platform === "darwin" || !settings.closeToTray) {
      return;
    }

    event.preventDefault();
    mainWindow?.hide();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isAllowedAppUrl(url)) {
      return { action: "allow" };
    }

    void shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (isAllowedAppUrl(url)) {
      return;
    }

    event.preventDefault();
    void shell.openExternal(url);
  });

  try {
    await mainWindow.loadURL(AURA_DESKTOP_URL);
  } catch (error) {
    log("error", "[window] failed to load Aura URL", error);
  }

  if (pendingDeepLink) {
    const deepLink = pendingDeepLink;
    pendingDeepLink = null;
    void handleDeepLink(deepLink);
  }
};

const showMainWindow = () => {
  if (!mainWindow) {
    void createMainWindow();
    return;
  }

  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }

  mainWindow.show();
  mainWindow.focus();
};

const handleDeepLink = async (deepLink: string) => {
  const targetUrl = resolveDeepLinkToAppUrl(deepLink);

  if (!targetUrl) {
    return false;
  }

  if (!mainWindow) {
    pendingDeepLink = deepLink;
    await createMainWindow();
  }

  showMainWindow();

  if (mainWindow && isAllowedAppUrl(targetUrl)) {
    await mainWindow.loadURL(targetUrl);
    return true;
  }

  return false;
};

const createTray = () => {
  tray = new Tray(getAssetPath("aura-icon.ico"));
  tray.setToolTip("Aura");
  tray.setContextMenu(Menu.buildFromTemplate([
    {
      label: "Open Aura",
      click: showMainWindow,
    },
    {
      type: "separator",
    },
    {
      label: "Quit Aura",
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]));

  tray.on("click", showMainWindow);
  tray.on("double-click", showMainWindow);
};

const normalizeNotificationText = (value: unknown, fallback: string) => {
  if (typeof value !== "string") {
    return fallback;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return fallback;
  }

  return trimmed.slice(0, 240);
};

const registerIpc = () => {
  ipcMain.handle("aura:app:get-version", () => app.getVersion());
  ipcMain.handle("aura:app:get-url", () => AURA_DESKTOP_URL);
  ipcMain.handle("aura:app:get-paths", () => ({
    logs: getLogFilePath(),
    settings: getSettingsFilePath(),
    userData: app.getPath("userData"),
  }));
  ipcMain.handle("aura:app:get-settings", () => readSettings());
  ipcMain.handle("aura:app:update-settings", (_event, patch: unknown) => {
    const record = typeof patch === "object" && patch ? patch as Record<string, unknown> : {};
    const nextSettings = updateSettings({
      closeToTray: typeof record.closeToTray === "boolean" ? record.closeToTray : undefined,
      launchAtStartup: typeof record.launchAtStartup === "boolean" ? record.launchAtStartup : undefined,
      openAsHidden: typeof record.openAsHidden === "boolean" ? record.openAsHidden : undefined,
    });

    app.setLoginItemSettings({
      openAtLogin: nextSettings.launchAtStartup,
      openAsHidden: nextSettings.openAsHidden,
    });

    return nextSettings;
  });
  ipcMain.handle("aura:app:is-login-item-enabled", () => app.getLoginItemSettings().openAtLogin);
  ipcMain.handle("aura:app:set-login-item-enabled", (_event, enabled: unknown) => {
    const nextSettings = updateSettings({ launchAtStartup: enabled === true });

    app.setLoginItemSettings({
      openAtLogin: nextSettings.launchAtStartup,
      openAsHidden: nextSettings.openAsHidden,
    });

    return app.getLoginItemSettings().openAtLogin;
  });
  ipcMain.handle("aura:diagnostics:get-log-file-path", () => getLogFilePath());
  ipcMain.handle("aura:diagnostics:read-recent-log", () => readRecentLog());
  ipcMain.handle("aura:updates:get-status", () => getUpdateStatus());
  ipcMain.handle("aura:updates:check", () => checkForUpdates());
  ipcMain.handle("aura:updates:download", () => downloadUpdate());
  ipcMain.on("aura:updates:quit-and-install", () => {
    quitAndInstall();
  });
  ipcMain.handle("aura:system:get-platform", () => process.platform);
  ipcMain.handle("aura:window:is-maximized", (event) => (
    BrowserWindow.fromWebContents(event.sender)?.isMaximized() ?? false
  ));
  ipcMain.handle("aura:notifications:is-supported", () => Notification.isSupported());
  ipcMain.handle("aura:notifications:show", (_event, payload: unknown) => {
    if (!Notification.isSupported()) {
      return false;
    }

    const record = typeof payload === "object" && payload ? payload as Record<string, unknown> : {};
    const notification = new Notification({
      title: normalizeNotificationText(record.title, "Aura"),
      body: normalizeNotificationText(record.body, ""),
      silent: record.silent === true,
      icon: getAssetPath("aura-icon.png"),
    });

    notification.on("click", showMainWindow);
    notification.show();

    return true;
  });

  ipcMain.on("aura:window:minimize", (event) => {
    BrowserWindow.fromWebContents(event.sender)?.minimize();
  });

  ipcMain.on("aura:window:maximize", (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);

    if (!window) {
      return;
    }

    if (window.isMaximized()) {
      window.unmaximize();
    } else {
      window.maximize();
    }
  });

  ipcMain.on("aura:window:close", (event) => {
    BrowserWindow.fromWebContents(event.sender)?.close();
  });
};

const gotSingleInstanceLock = app.requestSingleInstanceLock();

if (!gotSingleInstanceLock) {
  app.quit();
} else {
  initializeLogger();
  app.setAppUserModelId(APP_USER_MODEL_ID);
  app.setAsDefaultProtocolClient(DEEP_LINK_PROTOCOL);
  configureUpdater(() => mainWindow);

  const settings = readSettings();
  app.setLoginItemSettings({
    openAtLogin: settings.launchAtStartup,
    openAsHidden: settings.openAsHidden,
  });

  log("info", "[startup] Aura Desktop starting", {
    appVersion: app.getVersion(),
    auraUrl: AURA_DESKTOP_URL,
    isPackaged: app.isPackaged,
    platform: process.platform,
  });

  app.on("second-instance", (_event, commandLine) => {
    const deepLink = commandLine.find((value) => value.startsWith(`${DEEP_LINK_PROTOCOL}://`));

    if (deepLink) {
      void handleDeepLink(deepLink);
    } else {
      showMainWindow();
    }
  });

  app.whenReady().then(async () => {
    configureSecurityPolicy(AURA_DESKTOP_URL);
    registerIpc();
    createTray();
    splashWindow = createSplashWindow(getAssetPath("aura-icon.png"));
    const updateResult = await runStartupUpdateFlow((stage) => setSplashStage(splashWindow, stage));

    if (updateResult === "installing") {
      return;
    }

    await createMainWindow();
  }).catch((error: unknown) => {
    log("error", "[startup] failed to start", error);
    app.quit();
  });
}

app.on("open-url", (event, url) => {
  event.preventDefault();
  void handleDeepLink(url);
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    void createMainWindow();
  } else {
    showMainWindow();
  }
});

app.on("before-quit", () => {
  isQuitting = true;
  log("info", "[shutdown] Aura Desktop quitting");
});

process.on("uncaughtException", (error) => {
  log("error", "[process] uncaught exception", error);
});

process.on("unhandledRejection", (reason) => {
  log("error", "[process] unhandled rejection", reason);
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
