import { contextBridge, ipcRenderer } from "electron";
import type { IpcRendererEvent } from "electron";
import type { AuraDesktopApi } from "@aura/desktop-bridge";

const TITLEBAR_HEIGHT = 32;
const PRODUCT_CHANNEL = "Альфа";

const subscribeToMainEvent = <Payload>(channel: string, callback: (payload: Payload) => void) => {
  const listener = (_event: IpcRendererEvent, payload: Payload) => callback(payload);

  ipcRenderer.on(channel, listener);

  return () => {
    ipcRenderer.off(channel, listener);
  };
};

const reportNetworkStatus = (source: "initial" | "online" | "offline") => {
  ipcRenderer.send("aura:system:network-status", {
    online: navigator.onLine,
    source,
  });
};

const auraDesktop: AuraDesktopApi = {
  app: {
    getVersion: () => ipcRenderer.invoke("aura:app:get-version") as Promise<string>,
    getUrl: () => ipcRenderer.invoke("aura:app:get-url") as Promise<string>,
    getPaths: () => ipcRenderer.invoke("aura:app:get-paths") as ReturnType<AuraDesktopApi["app"]["getPaths"]>,
    getSettings: () => ipcRenderer.invoke("aura:app:get-settings") as ReturnType<AuraDesktopApi["app"]["getSettings"]>,
    updateSettings: (patch) => (
      ipcRenderer.invoke("aura:app:update-settings", patch) as ReturnType<AuraDesktopApi["app"]["updateSettings"]>
    ),
    isLoginItemEnabled: () => ipcRenderer.invoke("aura:app:is-login-item-enabled") as Promise<boolean>,
    setLoginItemEnabled: (enabled) => (
      ipcRenderer.invoke("aura:app:set-login-item-enabled", enabled) as Promise<boolean>
    ),
  },
  diagnostics: {
    getLogFilePath: () => ipcRenderer.invoke("aura:diagnostics:get-log-file-path") as Promise<string>,
    readRecentLog: () => ipcRenderer.invoke("aura:diagnostics:read-recent-log") as Promise<string>,
  },
  notifications: {
    isSupported: () => ipcRenderer.invoke("aura:notifications:is-supported") as Promise<boolean>,
    show: (payload) => ipcRenderer.invoke("aura:notifications:show", payload) as Promise<boolean>,
  },
  system: {
    getPlatform: () => ipcRenderer.invoke("aura:system:get-platform") as Promise<NodeJS.Platform>,
    getStatus: () => ipcRenderer.invoke("aura:system:get-status") as ReturnType<AuraDesktopApi["system"]["getStatus"]>,
    onSuspend: (callback) => subscribeToMainEvent<void>("aura:system:suspend", callback),
    onResume: (callback) => subscribeToMainEvent<void>("aura:system:resume", callback),
    onLock: (callback) => subscribeToMainEvent<void>("aura:system:lock", callback),
    onUnlock: (callback) => subscribeToMainEvent<void>("aura:system:unlock", callback),
    onNetworkChange: (callback) => {
      const listener = () => callback(navigator.onLine);

      window.addEventListener("online", listener);
      window.addEventListener("offline", listener);

      return () => {
        window.removeEventListener("online", listener);
        window.removeEventListener("offline", listener);
      };
    },
    onRendererReady: (callback) => subscribeToMainEvent<void>("aura:app:renderer-ready", callback),
    onRendererRecovering: (callback) => subscribeToMainEvent<void>("aura:app:renderer-recovering", callback),
    onRendererUnresponsive: (callback) => subscribeToMainEvent<void>("aura:app:unresponsive", callback),
    onRendererResponsive: (callback) => subscribeToMainEvent<void>("aura:app:responsive", callback),
    onLoadFailed: (callback) => subscribeToMainEvent("aura:app:load-failed", callback),
  },
  window: {
    isMaximized: () => ipcRenderer.invoke("aura:window:is-maximized") as Promise<boolean>,
    minimize: () => ipcRenderer.send("aura:window:minimize"),
    maximize: () => ipcRenderer.send("aura:window:maximize"),
    show: () => ipcRenderer.send("aura:window:show"),
    hideToTray: () => ipcRenderer.send("aura:window:hide-to-tray"),
    close: () => ipcRenderer.send("aura:window:close"),
  },
  updates: {
    getStatus: () => (
      ipcRenderer.invoke("aura:updates:get-status") as ReturnType<AuraDesktopApi["updates"]["getStatus"]>
    ),
    check: () => ipcRenderer.invoke("aura:updates:check") as ReturnType<AuraDesktopApi["updates"]["check"]>,
    download: () => ipcRenderer.invoke("aura:updates:download") as ReturnType<AuraDesktopApi["updates"]["download"]>,
    quitAndInstall: () => ipcRenderer.send("aura:updates:quit-and-install"),
  },
};

contextBridge.exposeInMainWorld("auraDesktop", auraDesktop);

window.addEventListener("online", () => reportNetworkStatus("online"));
window.addEventListener("offline", () => reportNetworkStatus("offline"));

if (document.readyState === "loading") {
  window.addEventListener("DOMContentLoaded", () => reportNetworkStatus("initial"), { once: true });
} else {
  reportNetworkStatus("initial");
}

const injectDesktopTitlebar = () => {
  if (document.getElementById("aura-desktop-titlebar")) {
    return;
  }

  const style = document.createElement("style");
  style.id = "aura-desktop-titlebar-style";
  style.textContent = `
    :root {
      --aura-desktop-titlebar-height: ${TITLEBAR_HEIGHT}px;
    }

    html,
    body {
      width: 100%;
      height: 100%;
      overflow: hidden !important;
      margin: 0;
    }

    body {
      padding-top: var(--aura-desktop-titlebar-height);
    }

    #root {
      height: calc(100vh - var(--aura-desktop-titlebar-height));
      min-height: 0;
      overflow: hidden;
    }

    html::-webkit-scrollbar,
    body::-webkit-scrollbar {
      width: 0;
      height: 0;
      display: none;
    }

    #aura-desktop-titlebar {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      height: var(--aura-desktop-titlebar-height);
      z-index: 2147483647;
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: transparent;
      color: rgba(255, 255, 255, 0.88);
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 12px;
      user-select: none;
      -webkit-app-region: drag;
      pointer-events: auto;
      contain: layout style;
    }

    #aura-desktop-titlebar .aura-desktop-titlebar-brand {
      display: flex;
      align-items: center;
      min-width: 0;
      height: 100%;
      padding-left: 14px;
      gap: 8px;
      font-weight: 600;
      letter-spacing: 0;
      text-shadow: 0 1px 8px rgba(0, 0, 0, 0.35);
      opacity: 0.92;
    }

    #aura-desktop-titlebar .aura-desktop-titlebar-mark {
      width: 16px;
      height: 16px;
      border-radius: 4px;
      background: linear-gradient(135deg, #63a8ff, #7d57ff 55%, #db4dd5);
      display: grid;
      place-items: center;
      box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.16) inset;
    }

    #aura-desktop-titlebar .aura-desktop-titlebar-mark svg {
      width: 10px;
      height: 13px;
      color: #ffffff;
    }

    #aura-desktop-titlebar .aura-desktop-titlebar-controls {
      display: flex;
      height: 100%;
      -webkit-app-region: no-drag;
      background: transparent;
    }

    #aura-desktop-titlebar button {
      width: 46px;
      height: 100%;
      border: 0;
      padding: 0;
      margin: 0;
      display: grid;
      place-items: center;
      color: rgba(255, 255, 255, 0.82);
      background: transparent;
      font: inherit;
      cursor: default;
    }

    #aura-desktop-titlebar button:hover {
      background: rgba(255, 255, 255, 0.1);
    }

    #aura-desktop-titlebar button[data-window-action="close"]:hover {
      background: #e81123;
      color: #ffffff;
    }

    #aura-desktop-titlebar svg {
      pointer-events: none;
    }
  `;

  const titlebar = document.createElement("div");
  titlebar.id = "aura-desktop-titlebar";
  titlebar.innerHTML = `
    <div class="aura-desktop-titlebar-brand" aria-hidden="true">
      <span class="aura-desktop-titlebar-mark">
        <svg viewBox="0 0 527 680" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M249.817 4.68584C252.283 -1.56196 261.126 -1.56194 263.592 4.68585L526.011 669.482C528.645 676.153 521.204 682.297 515.152 678.45L222.144 492.191C214.688 487.451 220.301 475.988 228.617 478.973L376.019 531.871C382.568 534.221 388.449 527.059 384.869 521.092L262.472 317.097C259.74 312.543 253.243 312.261 250.127 316.562L13.4569 643.166C8.34904 650.215 -2.62252 644.2 0.573641 636.103L249.817 4.68584Z" fill="currentColor"/>
        </svg>
      </span>
      <span id="aura-desktop-version">${PRODUCT_CHANNEL}</span>
    </div>
    <div class="aura-desktop-titlebar-controls">
      <button type="button" data-window-action="minimize" aria-label="Свернуть">
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
          <path d="M1 5h8" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
        </svg>
      </button>
      <button type="button" data-window-action="maximize" aria-label="Развернуть">
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
          <rect x="1.5" y="1.5" width="7" height="7" fill="none" stroke="currentColor" stroke-width="1.2"/>
        </svg>
      </button>
      <button type="button" data-window-action="close" aria-label="Закрыть">
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
          <path d="M2 2l6 6M8 2L2 8" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
        </svg>
      </button>
    </div>
  `;

  titlebar.addEventListener("click", (event) => {
    const target = event.target;

    if (!(target instanceof Element)) {
      return;
    }

    const button = target.closest<HTMLButtonElement>("button[data-window-action]");
    const action = button?.dataset.windowAction;

    if (action === "minimize") {
      auraDesktop.window.minimize();
    } else if (action === "maximize") {
      auraDesktop.window.maximize();
    } else if (action === "close") {
      auraDesktop.window.close();
    }
  });

  document.head.appendChild(style);
  document.body.prepend(titlebar);

  void auraDesktop.app.getVersion().then((version) => {
    const versionNode = document.getElementById("aura-desktop-version");

    if (versionNode) {
      versionNode.textContent = `${PRODUCT_CHANNEL} v${version}`;
    }
  });
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", injectDesktopTitlebar, { once: true });
} else {
  injectDesktopTitlebar();
}
