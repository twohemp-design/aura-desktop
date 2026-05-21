# Desktop Foundation

Aura Desktop is a separate Electron client that loads Aura through a configured URL and adds native desktop features around it.

## Current Scope

This foundation intentionally does not copy or modify the Aura web app.

The first app version provides:

- Electron main process;
- safe preload bridge;
- context isolation;
- no Node.js access in the renderer;
- single-instance behavior;
- frameless desktop window;
- injected desktop titlebar overlay;
- tray icon and restore behavior;
- close-to-tray behavior on Windows/Linux;
- controlled external link handling;
- Aura app/window icon;
- native notification bridge;
- Windows startup bridge;
- `aura://` protocol registration;
- local desktop settings store;
- local diagnostics log;
- manual update-check foundation;
- startup splash/preloader window;
- automatic startup update check/install when a signed update feed is configured;
- origin-scoped Electron permission policy;
- basic window controls;
- configurable Aura URL.

## Development URL

The desktop shell reads `AURA_DESKTOP_URL`.

Default:

```text
https://aurahub.ru
```

For local testing against a running web server:

```powershell
$env:AURA_DESKTOP_URL="http://127.0.0.1:3000"; npm run dev
```

## Commands

```powershell
npm install
npm run dev
npm run build
npm --workspace @aura/desktop run pack
npm run dist
npm run dist:release
```

## Build Outputs

Development unpacked app:

```text
apps/desktop/release/win-unpacked/Aura.exe
```

Windows installer:

```text
apps/desktop/release/Aura-Setup-0.1.0.exe
```

`npm run dist` creates a local unsigned installer for internal testing.

`npm run dist:release` is the production path and requires:

- `AURA_RELEASE_SIGNING=true`;
- `AURA_UPDATE_PROVIDER=github` or `AURA_UPDATE_URL`;
- `CSC_LINK` and `CSC_KEY_PASSWORD`, or `WIN_CSC_LINK` and `WIN_CSC_KEY_PASSWORD`.

Production release builds use Electron Builder's signing/editing path and publish update metadata to the configured generic update provider.

## Icon Source

The current desktop icon is copied from the web app's `public/pwa-512x512.png` into `apps/desktop/assets/aura-icon.png`, then converted to `apps/desktop/assets/aura-icon.ico`.

The web app remains the design source of truth while it is still in active development. Refresh the copied desktop icon when the web icon changes.

Local unsigned builds stamp the Windows executable icon through `apps/desktop/scripts/after-pack.cjs`.

Production release builds set `AURA_RELEASE_SIGNING=true` and use Electron Builder's signing/editing pipeline instead.

## Desktop Lifecycle

The app uses a single-instance lock. A second launch focuses the existing window.

The app registers the `aura://` protocol. Deep links are converted into paths on the configured Aura origin. For example, `aura://invite/example` resolves to `/invite/example` on `AURA_DESKTOP_URL`.

The preload bridge exposes startup controls:

```ts
window.auraDesktop.app.isLoginItemEnabled();
window.auraDesktop.app.setLoginItemEnabled(true);
```

## Desktop Settings

Desktop settings are stored in Electron's `userData` directory as `desktop-settings.json`.

Current settings:

- `closeToTray`;
- `launchAtStartup`;
- `openAsHidden`.

Bridge:

```ts
window.auraDesktop.app.getSettings();
window.auraDesktop.app.updateSettings({ closeToTray: false });
window.auraDesktop.app.getPaths();
```

## Diagnostics

Aura Desktop writes a local diagnostics log under the Electron `userData` directory.

The logger redacts common token and authorization patterns before writing.

Bridge:

```ts
window.auraDesktop.diagnostics.getLogFilePath();
window.auraDesktop.diagnostics.readRecentLog();
```

## Splash And Updates

Aura Desktop shows a native splash window before the main Aura window.

Startup stages:

1. `Checking for updates...`
2. `Downloading update...` when an update is available.
3. `Installing update...` after download.
4. `Starting...` when continuing into Aura.

If no signed update feed is configured, the app logs that update checks are skipped and continues startup.

The updater foundation uses `electron-updater`.

Bridge:

```ts
window.auraDesktop.updates.getStatus();
window.auraDesktop.updates.check();
window.auraDesktop.updates.download();
window.auraDesktop.updates.quitAndInstall();
```

Production automatic updates require a signed installer and `AURA_UPDATE_URL`.

## Security Baseline

Renderer security settings:

- `contextIsolation: true`;
- `nodeIntegration: false`;
- `sandbox: true`;
- bridge exposed through `window.auraDesktop`;
- external navigation is blocked and opened in the system browser.

Session security settings:

- only the configured Aura origin can request media, display capture, notifications, fullscreen, and speaker selection;
- device permissions are limited to audio input, audio output, and video input from the Aura origin;
- top-level navigation away from Aura is blocked and opened externally;
- denied permissions are written to the diagnostics log.

Do not add backend secrets to this desktop app.
