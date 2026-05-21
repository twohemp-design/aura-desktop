export type AuraDesktopSettings = {
  closeToTray: boolean;
  launchAtStartup: boolean;
  openAsHidden: boolean;
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
  system: {
    getPlatform: () => Promise<NodeJS.Platform>;
    onResume: (callback: () => void) => () => void;
    onUnlock: (callback: () => void) => () => void;
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
