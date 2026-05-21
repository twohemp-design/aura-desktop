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

export type AuraDesktopPaths = {
  logs: string;
  settings: string;
  userData: string;
};

export type AuraUpdateStatus = {
  checking: boolean;
  lastError: string | null;
  updateAvailable: boolean;
  updateDownloaded: boolean;
  version: string | null;
};

export type AuraNotificationPayload = {
  title?: string;
  body?: string;
  silent?: boolean;
};

export type AuraSystemStatus = {
  platform: NodeJS.Platform;
  online: boolean | null;
};

export type AuraLoadFailure = {
  errorCode: number;
  errorDescription: string;
  url: string;
};

export type AuraMediaPermission = "media" | "display-capture" | "notifications" | "speaker-selection";

export type AuraPermissionStatus = "granted" | "denied" | "prompt" | "unknown";

export type AuraMediaPermissionStatus = Record<AuraMediaPermission, AuraPermissionStatus>;

export type AuraDisplaySourceKind = "screen" | "window";

export type AuraDisplaySource = {
  id: string;
  name: string;
  displayId: string;
  kind: AuraDisplaySourceKind;
  thumbnailDataUrl: string;
  appIconDataUrl: string | null;
};

export type AuraDisplaySourceOptions = {
  types?: AuraDisplaySourceKind[];
  thumbnailWidth?: number;
  thumbnailHeight?: number;
};

export type AuraVoiceHotkeyAction = "mute-toggle" | "deafen-toggle" | "push-to-talk";

export type AuraVoiceHotkeySettings = Partial<Record<AuraVoiceHotkeyAction, string>>;

export type AuraVoiceHotkeyEvent = {
  action: AuraVoiceHotkeyAction;
  accelerator: string;
};

export type AuraVoiceHotkeyRegistration = {
  registered: AuraVoiceHotkeySettings;
  failed: AuraVoiceHotkeySettings;
};

export type AuraDesktopApi = {
  app: {
    getVersion: () => Promise<string>;
    getUrl: () => Promise<string>;
    getPaths: () => Promise<AuraDesktopPaths>;
    getSettings: () => Promise<AuraDesktopSettings>;
    updateSettings: (patch: Partial<AuraDesktopSettings>) => Promise<AuraDesktopSettings>;
    isLoginItemEnabled: () => Promise<boolean>;
    setLoginItemEnabled: (enabled: boolean) => Promise<boolean>;
  };
  diagnostics: {
    getLogFilePath: () => Promise<string>;
    readRecentLog: () => Promise<string>;
  };
  notifications: {
    isSupported: () => Promise<boolean>;
    show: (payload: AuraNotificationPayload) => Promise<boolean>;
  };
  media: {
    getPermissionStatus: () => Promise<AuraMediaPermissionStatus>;
    getDisplaySources: (options?: AuraDisplaySourceOptions) => Promise<AuraDisplaySource[]>;
  };
  voice: {
    getHotkeys: () => Promise<AuraVoiceHotkeySettings>;
    setHotkeys: (hotkeys: AuraVoiceHotkeySettings) => Promise<AuraVoiceHotkeyRegistration>;
    clearHotkeys: () => Promise<void>;
    onHotkey: (callback: (event: AuraVoiceHotkeyEvent) => void) => () => void;
  };
  system: {
    getPlatform: () => Promise<NodeJS.Platform>;
    getStatus: () => Promise<AuraSystemStatus>;
    onSuspend: (callback: () => void) => () => void;
    onResume: (callback: () => void) => () => void;
    onLock: (callback: () => void) => () => void;
    onUnlock: (callback: () => void) => () => void;
    onNetworkChange: (callback: (online: boolean) => void) => () => void;
    onRendererReady: (callback: () => void) => () => void;
    onRendererRecovering: (callback: () => void) => () => void;
    onRendererUnresponsive: (callback: () => void) => () => void;
    onRendererResponsive: (callback: () => void) => () => void;
    onLoadFailed: (callback: (failure: AuraLoadFailure) => void) => () => void;
  };
  updates: {
    getStatus: () => Promise<AuraUpdateStatus>;
    check: () => Promise<AuraUpdateStatus>;
    download: () => Promise<AuraUpdateStatus>;
    quitAndInstall: () => void;
  };
  window: {
    isMaximized: () => Promise<boolean>;
    minimize: () => void;
    maximize: () => void;
    show: () => void;
    hideToTray: () => void;
    close: () => void;
  };
};
