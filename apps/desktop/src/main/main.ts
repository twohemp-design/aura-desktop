import {
  app,
  BrowserWindow,
  desktopCapturer,
  globalShortcut,
  ipcMain,
  Menu,
  Notification,
  powerMonitor,
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
const MAX_MAIN_FRAME_LOAD_RETRIES = 2;
const MAIN_FRAME_LOAD_RETRY_DELAY_MS = 2500;
const DEFAULT_DISPLAY_THUMBNAIL_SIZE = 360;
const MAX_DISPLAY_THUMBNAIL_SIZE = 720;
const MEDIA_PERMISSIONS = ["media", "display-capture", "notifications", "speaker-selection"] as const;
const VOICE_HOTKEY_ACTIONS = ["mute-toggle", "deafen-toggle", "push-to-talk"] as const;

let mainWindow: BrowserWindow | null = null;
let splashWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;
let pendingDeepLink: string | null = null;
let openMainWindowHidden = false;
let mainFrameLoadRetries = 0;
let rendererOnline: boolean | null = null;
let registeredVoiceHotkeys = new Map<string, typeof VOICE_HOTKEY_ACTIONS[number]>();

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

    if (openMainWindowHidden) {
      openMainWindowHidden = false;
      mainWindow?.setSkipTaskbar(true);
      return;
    }

    mainWindow?.show();
  });

  mainWindow.on("close", (event) => {
    const settings = readSettings();

    if (isQuitting || process.platform === "darwin" || !settings.closeToTray) {
      return;
    }

    event.preventDefault();
    hideMainWindowToTray();
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

  mainWindow.webContents.on("did-finish-load", () => {
    mainFrameLoadRetries = 0;
    mainWindow?.webContents.send("aura:app:renderer-ready");
    log("info", "[window] Aura URL loaded");
  });

  mainWindow.webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedUrl, isMainFrame) => {
    const failedUrl = validatedUrl || AURA_DESKTOP_URL;

    log("warn", "[window] failed to load frame", {
      errorCode,
      errorDescription,
      isMainFrame,
      validatedUrl: failedUrl,
    });

    if (errorCode === -3) {
      return;
    }

    if (!isMainFrame || isQuitting || !isAllowedAppUrl(failedUrl)) {
      return;
    }

    if (mainFrameLoadRetries >= MAX_MAIN_FRAME_LOAD_RETRIES) {
      mainWindow?.webContents.send("aura:app:load-failed", {
        errorCode,
        errorDescription,
        url: failedUrl,
      });
      return;
    }

    mainFrameLoadRetries += 1;
    setTimeout(() => {
      if (!mainWindow || mainWindow.isDestroyed() || isQuitting) {
        return;
      }

      log("info", "[window] retrying Aura URL load", { attempt: mainFrameLoadRetries });
      void mainWindow.loadURL(AURA_DESKTOP_URL);
    }, MAIN_FRAME_LOAD_RETRY_DELAY_MS);
  });

  mainWindow.webContents.on("render-process-gone", (_event, details) => {
    log("error", "[window] renderer process gone", details);

    if (isQuitting) {
      return;
    }

    setTimeout(() => {
      if (!mainWindow || mainWindow.isDestroyed() || isQuitting) {
        return;
      }

      mainFrameLoadRetries = 0;
      mainWindow.webContents.send("aura:app:renderer-recovering", details);
      mainWindow.webContents.reload();
    }, 1000);
  });

  mainWindow.on("unresponsive", () => {
    log("warn", "[window] renderer unresponsive");
    mainWindow?.webContents.send("aura:app:unresponsive");
  });

  mainWindow.on("responsive", () => {
    log("info", "[window] renderer responsive");
    mainWindow?.webContents.send("aura:app:responsive");
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
    openMainWindowHidden = false;
    void createMainWindow();
    return;
  }

  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }

  mainWindow.show();
  mainWindow.setSkipTaskbar(false);
  mainWindow.focus();
};

const hideMainWindowToTray = () => {
  if (!mainWindow) {
    return;
  }

  mainWindow.hide();
  mainWindow.setSkipTaskbar(true);
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
  tray.setToolTip("Aura Desktop");
  tray.setContextMenu(Menu.buildFromTemplate([
    {
      label: "Открыть Aura",
      click: showMainWindow,
    },
    {
      label: "Скрыть в трей",
      click: hideMainWindowToTray,
    },
    {
      type: "separator",
    },
    {
      label: "Выйти из Aura",
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

const clampThumbnailSize = (value: unknown) => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return DEFAULT_DISPLAY_THUMBNAIL_SIZE;
  }

  return Math.min(MAX_DISPLAY_THUMBNAIL_SIZE, Math.max(80, Math.round(value)));
};

const normalizeDisplaySourceTypes = (value: unknown) => {
  if (!Array.isArray(value)) {
    return ["screen", "window"] satisfies Array<"screen" | "window">;
  }

  const normalized = value.filter((type): type is "screen" | "window" => type === "screen" || type === "window");

  return normalized.length > 0 ? normalized : ["screen", "window"] satisfies Array<"screen" | "window">;
};

const getMediaPermissionStatus = () => {
  const baseStatus = Object.fromEntries(MEDIA_PERMISSIONS.map((permission) => [permission, "prompt"]));

  return {
    ...baseStatus,
    notifications: Notification.isSupported() ? "prompt" : "denied",
  };
};

const getDisplaySources = async (payload: unknown) => {
  const record = typeof payload === "object" && payload ? payload as Record<string, unknown> : {};
  const thumbnailSize = {
    width: clampThumbnailSize(record.thumbnailWidth),
    height: clampThumbnailSize(record.thumbnailHeight),
  };
  const types = normalizeDisplaySourceTypes(record.types);
  const sources = await desktopCapturer.getSources({
    types,
    thumbnailSize,
    fetchWindowIcons: true,
  });

  return sources.map((source) => ({
    id: source.id,
    name: source.name,
    displayId: source.display_id,
    kind: source.id.startsWith("screen:") ? "screen" : "window",
    thumbnailDataUrl: source.thumbnail.toDataURL(),
    appIconDataUrl: source.appIcon?.isEmpty() === false ? source.appIcon.toDataURL() : null,
  }));
};

const normalizeVoiceHotkeySettings = (payload: unknown) => {
  const record = typeof payload === "object" && payload ? payload as Record<string, unknown> : {};

  return {
    "deafen-toggle": typeof record["deafen-toggle"] === "string"
      ? record["deafen-toggle"]
      : typeof record.deafenToggle === "string"
        ? record.deafenToggle
        : undefined,
    "mute-toggle": typeof record["mute-toggle"] === "string"
      ? record["mute-toggle"]
      : typeof record.muteToggle === "string"
        ? record.muteToggle
        : undefined,
    "push-to-talk": typeof record["push-to-talk"] === "string"
      ? record["push-to-talk"]
      : typeof record.pushToTalk === "string"
        ? record.pushToTalk
        : undefined,
  };
};

const readVoiceHotkeys = () => {
  const { voiceHotkeys } = readSettings();

  return {
    "deafen-toggle": voiceHotkeys.deafenToggle,
    "mute-toggle": voiceHotkeys.muteToggle,
    "push-to-talk": voiceHotkeys.pushToTalk,
  };
};

const unregisterVoiceHotkeys = () => {
  for (const accelerator of registeredVoiceHotkeys.keys()) {
    globalShortcut.unregister(accelerator);
  }

  registeredVoiceHotkeys = new Map();
};

const registerVoiceHotkeys = (hotkeys: ReturnType<typeof normalizeVoiceHotkeySettings>) => {
  unregisterVoiceHotkeys();

  const registered: Record<string, string> = {};
  const failed: Record<string, string> = {};

  for (const action of VOICE_HOTKEY_ACTIONS) {
    const accelerator = hotkeys[action]?.trim();

    if (!accelerator) {
      continue;
    }

    const didRegister = globalShortcut.register(accelerator, () => {
      log("info", "[voice] global hotkey pressed", { action, accelerator });
      mainWindow?.webContents.send("aura:voice:hotkey", { action, accelerator });
    });

    if (didRegister) {
      registered[action] = accelerator;
      registeredVoiceHotkeys.set(accelerator, action);
    } else {
      failed[action] = accelerator;
      log("warn", "[voice] failed to register global hotkey", { action, accelerator });
    }
  }

  return { registered, failed };
};

const persistVoiceHotkeys = (hotkeys: ReturnType<typeof normalizeVoiceHotkeySettings>) => {
  const current = readSettings().voiceHotkeys;

  updateSettings({
    voiceHotkeys: {
      deafenToggle: hotkeys["deafen-toggle"] ?? current.deafenToggle,
      muteToggle: hotkeys["mute-toggle"] ?? current.muteToggle,
      pushToTalk: hotkeys["push-to-talk"] ?? current.pushToTalk,
    },
  });
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
    const currentVoiceHotkeys = readSettings().voiceHotkeys;
    const voiceRecord = typeof record.voiceHotkeys === "object" && record.voiceHotkeys
      ? record.voiceHotkeys as Record<string, unknown>
      : null;
    const voiceHotkeys = typeof record.voiceHotkeys === "object" && record.voiceHotkeys
      ? {
          deafenToggle: typeof voiceRecord?.deafenToggle === "string"
            ? voiceRecord.deafenToggle
            : currentVoiceHotkeys.deafenToggle,
          muteToggle: typeof voiceRecord?.muteToggle === "string"
            ? voiceRecord.muteToggle
            : currentVoiceHotkeys.muteToggle,
          pushToTalk: typeof voiceRecord?.pushToTalk === "string"
            ? voiceRecord.pushToTalk
            : currentVoiceHotkeys.pushToTalk,
        }
      : undefined;
    const nextSettings = updateSettings({
      closeToTray: typeof record.closeToTray === "boolean" ? record.closeToTray : undefined,
      launchAtStartup: typeof record.launchAtStartup === "boolean" ? record.launchAtStartup : undefined,
      openAsHidden: typeof record.openAsHidden === "boolean" ? record.openAsHidden : undefined,
      voiceHotkeys,
    });

    app.setLoginItemSettings({
      openAtLogin: nextSettings.launchAtStartup,
      openAsHidden: nextSettings.openAsHidden,
      args: nextSettings.launchAtStartup && nextSettings.openAsHidden ? ["--hidden"] : [],
    });

    return nextSettings;
  });
  ipcMain.handle("aura:app:is-login-item-enabled", () => app.getLoginItemSettings().openAtLogin);
  ipcMain.handle("aura:app:set-login-item-enabled", (_event, enabled: unknown) => {
    const nextSettings = updateSettings({ launchAtStartup: enabled === true });

    app.setLoginItemSettings({
      openAtLogin: nextSettings.launchAtStartup,
      openAsHidden: nextSettings.openAsHidden,
      args: nextSettings.launchAtStartup && nextSettings.openAsHidden ? ["--hidden"] : [],
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
  ipcMain.handle("aura:system:get-status", () => ({
    platform: process.platform,
    online: rendererOnline,
  }));
  ipcMain.on("aura:system:network-status", (_event, payload: unknown) => {
    const record = typeof payload === "object" && payload ? payload as Record<string, unknown> : {};
    rendererOnline = record.online === true;
    log("info", "[network] renderer network status", {
      online: rendererOnline,
      source: typeof record.source === "string" ? record.source : "renderer",
    });
  });
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

    mainWindow?.flashFrame(true);
    notification.on("click", () => {
      mainWindow?.flashFrame(false);
      showMainWindow();
    });
    notification.on("close", () => {
      mainWindow?.flashFrame(false);
    });
    notification.show();

    return true;
  });
  ipcMain.handle("aura:media:get-permission-status", () => getMediaPermissionStatus());
  ipcMain.handle("aura:media:get-display-sources", (_event, payload: unknown) => getDisplaySources(payload));
  ipcMain.handle("aura:voice:get-hotkeys", () => readVoiceHotkeys());
  ipcMain.handle("aura:voice:set-hotkeys", (_event, payload: unknown) => {
    const hotkeys = normalizeVoiceHotkeySettings(payload);

    persistVoiceHotkeys(hotkeys);
    return registerVoiceHotkeys(readVoiceHotkeys());
  });
  ipcMain.handle("aura:voice:clear-hotkeys", () => {
    unregisterVoiceHotkeys();
    updateSettings({
      voiceHotkeys: {
        deafenToggle: "",
        muteToggle: "",
        pushToTalk: "",
      },
    });
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

  ipcMain.on("aura:window:show", () => {
    showMainWindow();
  });

  ipcMain.on("aura:window:hide-to-tray", () => {
    hideMainWindowToTray();
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
    args: settings.launchAtStartup && settings.openAsHidden ? ["--hidden"] : [],
  });
  openMainWindowHidden = process.argv.includes("--hidden");

  log("info", "[startup] Aura Desktop starting", {
    appVersion: app.getVersion(),
    auraUrl: AURA_DESKTOP_URL,
    isPackaged: app.isPackaged,
    platform: process.platform,
  });

  app.on("second-instance", (_event, commandLine) => {
    const deepLink = commandLine.find((value) => value.startsWith(`${DEEP_LINK_PROTOCOL}://`));
    openMainWindowHidden = false;

    if (deepLink) {
      void handleDeepLink(deepLink);
    } else {
      showMainWindow();
    }
  });

  app.whenReady().then(async () => {
    configureSecurityPolicy(AURA_DESKTOP_URL);
    registerIpc();
    registerPowerMonitor();
    registerVoiceHotkeys(readVoiceHotkeys());
    createTray();
    splashWindow = openMainWindowHidden ? null : createSplashWindow(getAssetPath("aura-icon.png"));
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

const registerPowerMonitor = () => {
  powerMonitor.on("suspend", () => {
    log("info", "[power] system suspend");
    mainWindow?.webContents.send("aura:system:suspend");
  });

  powerMonitor.on("resume", () => {
    log("info", "[power] system resume");
    mainWindow?.webContents.send("aura:system:resume");
  });

  powerMonitor.on("lock-screen", () => {
    log("info", "[power] screen locked");
    mainWindow?.webContents.send("aura:system:lock");
  });

  powerMonitor.on("unlock-screen", () => {
    log("info", "[power] screen unlocked");
    mainWindow?.webContents.send("aura:system:unlock");
  });
};

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    void createMainWindow();
  } else {
    showMainWindow();
  }
});

app.on("before-quit", () => {
  isQuitting = true;
  unregisterVoiceHotkeys();
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
