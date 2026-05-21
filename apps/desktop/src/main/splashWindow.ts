import { BrowserWindow } from "electron";
import path from "node:path";

export type SplashStage = "checking" | "downloading" | "installing" | "starting";

const escapeHtml = (value: string) => (
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
);

const getSplashHtml = (initialMessage: string) => `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data:;">
    <style>
      html,
      body {
        width: 100%;
        height: 100%;
        margin: 0;
        overflow: hidden;
        background: transparent;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        color: rgba(255, 255, 255, 0.92);
        user-select: none;
      }

      body {
        display: grid;
        place-items: center;
        -webkit-app-region: drag;
      }

      .shell {
        width: 420px;
        height: 360px;
        position: relative;
        display: grid;
        place-items: center;
        overflow: hidden;
        background:
          radial-gradient(circle at 18% 18%, rgba(125, 87, 255, 0.38), transparent 34%),
          radial-gradient(circle at 83% 77%, rgba(219, 77, 213, 0.28), transparent 40%),
          linear-gradient(145deg, #160d25 0%, #0c0715 54%, #060407 100%);
        border: 1px solid rgba(255, 255, 255, 0.1);
        box-shadow: 0 24px 80px rgba(0, 0, 0, 0.45);
      }

      .stars {
        position: absolute;
        inset: 0;
        background-image:
          radial-gradient(circle, rgba(255,255,255,0.7) 0 1px, transparent 1.5px),
          radial-gradient(circle, rgba(124,163,255,0.55) 0 1px, transparent 1.5px);
        background-size: 54px 54px, 82px 82px;
        background-position: 0 0, 24px 16px;
        opacity: 0.22;
        animation: drift 8s linear infinite;
      }

      .content {
        position: relative;
        z-index: 1;
        display: grid;
        justify-items: center;
        gap: 22px;
      }

      .mark {
        width: 86px;
        height: 86px;
        border-radius: 24px;
        display: grid;
        place-items: center;
        background: rgba(255, 255, 255, 0.08);
        border: 1px solid rgba(255, 255, 255, 0.15);
        box-shadow: 0 0 42px rgba(125, 87, 255, 0.24);
      }

      .mark svg {
        width: 42px;
        height: 54px;
        color: #ffffff;
        filter: drop-shadow(0 0 18px rgba(126, 168, 255, 0.35));
        animation: pulse 1.9s ease-in-out infinite;
      }

      .message {
        min-height: 22px;
        font-size: 15px;
        font-weight: 700;
        letter-spacing: 0;
        text-align: center;
      }

      .bar {
        width: 172px;
        height: 3px;
        overflow: hidden;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.12);
      }

      .bar::before {
        content: "";
        display: block;
        width: 44%;
        height: 100%;
        border-radius: inherit;
        background: linear-gradient(90deg, #70a8ff, #8758ff, #e14dcc);
        animation: progress 1.15s ease-in-out infinite;
      }

      @keyframes progress {
        0% { transform: translateX(-100%); }
        100% { transform: translateX(260%); }
      }

      @keyframes pulse {
        0%, 100% { transform: translateY(0) scale(1); opacity: 0.92; }
        50% { transform: translateY(-2px) scale(1.035); opacity: 1; }
      }

      @keyframes drift {
        from { transform: translateY(0); }
        to { transform: translateY(54px); }
      }
    </style>
  </head>
  <body>
    <main class="shell">
      <div class="stars"></div>
      <section class="content">
        <div class="mark" aria-hidden="true">
          <svg viewBox="0 0 527 680" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M249.817 4.68584C252.283 -1.56196 261.126 -1.56194 263.592 4.68585L526.011 669.482C528.645 676.153 521.204 682.297 515.152 678.45L222.144 492.191C214.688 487.451 220.301 475.988 228.617 478.973L376.019 531.871C382.568 534.221 388.449 527.059 384.869 521.092L262.472 317.097C259.74 312.543 253.243 312.261 250.127 316.562L13.4569 643.166C8.34904 650.215 -2.62252 644.2 0.573641 636.103L249.817 4.68584Z" fill="currentColor"/>
          </svg>
        </div>
        <div id="message" class="message">${escapeHtml(initialMessage)}</div>
        <div class="bar" aria-hidden="true"></div>
      </section>
    </main>
    <script>
      window.setAuraSplashStatus = function(message) {
        document.getElementById("message").textContent = message;
      };
    </script>
  </body>
</html>
`;

const getMessage = (stage: SplashStage) => {
  if (stage === "checking") {
    return "Checking for updates...";
  }

  if (stage === "downloading") {
    return "Downloading update...";
  }

  if (stage === "installing") {
    return "Installing update...";
  }

  return "Starting...";
};

export const createSplashWindow = (iconPath: string) => {
  const splashWindow = new BrowserWindow({
    width: 420,
    height: 360,
    center: true,
    resizable: false,
    movable: true,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    frame: false,
    transparent: true,
    hasShadow: true,
    show: false,
    title: "Aura",
    icon: iconPath,
    webPreferences: {
      partition: "aura:splash",
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  void splashWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(getSplashHtml(getMessage("checking")))}`);
  splashWindow.once("ready-to-show", () => splashWindow.show());

  return splashWindow;
};

export const setSplashStage = (splashWindow: BrowserWindow | null, stage: SplashStage) => {
  if (!splashWindow || splashWindow.isDestroyed()) {
    return;
  }

  const message = getMessage(stage);
  void splashWindow.webContents.executeJavaScript(
    `window.setAuraSplashStatus(${JSON.stringify(message)})`,
    true,
  );
};

export const closeSplashWindow = (splashWindow: BrowserWindow | null) => {
  if (!splashWindow || splashWindow.isDestroyed()) {
    return;
  }

  splashWindow.close();
};
