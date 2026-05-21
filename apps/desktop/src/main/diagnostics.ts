import {
  app,
  BrowserWindow,
  desktopCapturer,
  Notification,
  screen,
} from "electron";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { getLogFilePath, readRecentLog } from "./logger";
import type { AuraDesktopSettings } from "./settings";
import type { AuraUpdateStatus } from "./updater";

export type AuraDesktopDiagnosticsInput = {
  auraUrl: string;
  closeToTray: boolean;
  registeredVoiceHotkeys: Record<string, string>;
  rendererOnline: boolean | null;
  settings: AuraDesktopSettings;
  updateStatus: AuraUpdateStatus;
};

const REPORTS_DIR = "diagnostics";

const getDiagnosticsDir = () => path.join(app.getPath("userData"), REPORTS_DIR);

const sanitizeFilePart = (value: string) => value.replace(/[^a-zA-Z0-9._-]/g, "-");

const getWindowSnapshot = (window: BrowserWindow | null) => {
  if (!window || window.isDestroyed()) {
    return {
      exists: false,
    };
  }

  return {
    exists: true,
    bounds: window.getBounds(),
    contentBounds: window.getContentBounds(),
    focused: window.isFocused(),
    fullscreen: window.isFullScreen(),
    maximized: window.isMaximized(),
    minimized: window.isMinimized(),
    visible: window.isVisible(),
    webContents: {
      crashed: window.webContents.isCrashed(),
      loading: window.webContents.isLoading(),
      url: window.webContents.getURL(),
    },
  };
};

const getDisplaySourceSummary = async () => {
  const sources = await desktopCapturer.getSources({
    fetchWindowIcons: false,
    thumbnailSize: {
      width: 1,
      height: 1,
    },
    types: ["screen", "window"],
  });

  return {
    count: sources.length,
    sources: sources.map((source) => ({
      displayId: source.display_id,
      id: source.id,
      kind: source.id.startsWith("screen:") ? "screen" : "window",
      name: source.name,
    })),
  };
};

export const buildDiagnosticsReport = async (
  window: BrowserWindow | null,
  input: AuraDesktopDiagnosticsInput,
) => {
  const displays = screen.getAllDisplays();

  return {
    generatedAt: new Date().toISOString(),
    app: {
      appPath: app.getAppPath(),
      executablePath: app.getPath("exe"),
      isPackaged: app.isPackaged,
      locale: app.getLocale(),
      name: app.getName(),
      version: app.getVersion(),
    },
    aura: {
      url: input.auraUrl,
    },
    diagnostics: {
      reportsDir: getDiagnosticsDir(),
    },
    environment: {
      arch: process.arch,
      chrome: process.versions.chrome,
      electron: process.versions.electron,
      node: process.versions.node,
      platform: process.platform,
      systemVersion: process.getSystemVersion(),
      uptimeSeconds: Math.round(process.uptime()),
    },
    logs: {
      filePath: getLogFilePath(),
      recent: readRecentLog(32 * 1024),
    },
    notifications: {
      supported: Notification.isSupported(),
    },
    os: {
      cpus: os.cpus().map((cpu) => ({
        model: cpu.model,
        speed: cpu.speed,
      })),
      freemem: os.freemem(),
      hostname: os.hostname(),
      release: os.release(),
      totalmem: os.totalmem(),
      type: os.type(),
    },
    renderer: {
      online: input.rendererOnline,
    },
    settings: input.settings,
    tray: {
      closeToTray: input.closeToTray,
    },
    updates: input.updateStatus,
    voice: {
      registeredHotkeys: input.registeredVoiceHotkeys,
      settings: input.settings.voiceHotkeys,
    },
    window: getWindowSnapshot(window),
    screens: {
      count: displays.length,
      displays: displays.map((display) => ({
        bounds: display.bounds,
        id: display.id,
        internal: display.internal,
        scaleFactor: display.scaleFactor,
        size: display.size,
        workArea: display.workArea,
      })),
    },
    screenShare: await getDisplaySourceSummary(),
  };
};

export const writeDiagnosticsReport = async (
  window: BrowserWindow | null,
  input: AuraDesktopDiagnosticsInput,
) => {
  const report = await buildDiagnosticsReport(window, input);
  const reportsDir = getDiagnosticsDir();
  const fileName = `aura-diagnostics-${sanitizeFilePart(report.generatedAt)}.json`;
  const filePath = path.join(reportsDir, fileName);

  fs.mkdirSync(reportsDir, { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  return {
    filePath,
    report,
  };
};

export const getDiagnosticsDirectory = () => {
  const reportsDir = getDiagnosticsDir();

  fs.mkdirSync(reportsDir, { recursive: true });

  return reportsDir;
};
