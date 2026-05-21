import { app } from "electron";
import fs from "node:fs";
import path from "node:path";

export type AuraDesktopSettings = {
  closeToTray: boolean;
  launchAtStartup: boolean;
  openAsHidden: boolean;
  voiceHotkeys: {
    deafenToggle: string;
    muteToggle: string;
    pushToTalk: string;
  };
};

const SETTINGS_FILE = "desktop-settings.json";

const DEFAULT_SETTINGS: AuraDesktopSettings = {
  closeToTray: true,
  launchAtStartup: false,
  openAsHidden: true,
  voiceHotkeys: {
    deafenToggle: "CommandOrControl+Shift+D",
    muteToggle: "CommandOrControl+Shift+M",
    pushToTalk: "CommandOrControl+Shift+Space",
  },
};

const getSettingsPath = () => path.join(app.getPath("userData"), SETTINGS_FILE);

const ensureSettingsShape = (value: unknown): AuraDesktopSettings => {
  const record = typeof value === "object" && value ? value as Record<string, unknown> : {};

  return {
    closeToTray: typeof record.closeToTray === "boolean" ? record.closeToTray : DEFAULT_SETTINGS.closeToTray,
    launchAtStartup: typeof record.launchAtStartup === "boolean"
      ? record.launchAtStartup
      : DEFAULT_SETTINGS.launchAtStartup,
    openAsHidden: typeof record.openAsHidden === "boolean" ? record.openAsHidden : DEFAULT_SETTINGS.openAsHidden,
    voiceHotkeys: {
      ...DEFAULT_SETTINGS.voiceHotkeys,
      ...(typeof record.voiceHotkeys === "object" && record.voiceHotkeys
        ? {
            deafenToggle: typeof (record.voiceHotkeys as Record<string, unknown>).deafenToggle === "string"
              ? (record.voiceHotkeys as Record<string, string>).deafenToggle
              : DEFAULT_SETTINGS.voiceHotkeys.deafenToggle,
            muteToggle: typeof (record.voiceHotkeys as Record<string, unknown>).muteToggle === "string"
              ? (record.voiceHotkeys as Record<string, string>).muteToggle
              : DEFAULT_SETTINGS.voiceHotkeys.muteToggle,
            pushToTalk: typeof (record.voiceHotkeys as Record<string, unknown>).pushToTalk === "string"
              ? (record.voiceHotkeys as Record<string, string>).pushToTalk
              : DEFAULT_SETTINGS.voiceHotkeys.pushToTalk,
          }
        : {}),
    },
  };
};

export const readSettings = () => {
  try {
    const settingsPath = getSettingsPath();
    const raw = fs.readFileSync(settingsPath, "utf8");

    return ensureSettingsShape(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
};

export const writeSettings = (settings: AuraDesktopSettings) => {
  const settingsPath = getSettingsPath();
  fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
  fs.writeFileSync(settingsPath, `${JSON.stringify(settings, null, 2)}\n`, "utf8");
};

export const updateSettings = (patch: Partial<AuraDesktopSettings>) => {
  const nextSettings = ensureSettingsShape({
    ...readSettings(),
    ...patch,
  });

  writeSettings(nextSettings);

  return nextSettings;
};

export const getSettingsFilePath = () => getSettingsPath();
