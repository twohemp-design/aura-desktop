# Aura Desktop Security Hardening

This document tracks the desktop security baseline for the Electron shell. The Aura web application remains separate and is not modified by this repository.

## Current Baseline

- Renderer runs with `nodeIntegration: false`.
- Renderer runs with `contextIsolation: true`.
- Renderer runs with `sandbox: true`.
- Web security is enabled.
- Insecure content is disabled.
- DevTools are disabled in packaged builds.
- Main-frame navigation is restricted to the configured Aura origin.
- External links are opened only for safe protocols:
  - `http:`
  - `https:`
  - `mailto:`
- Unsafe protocols such as `file:`, `javascript:`, and custom unknown schemes are blocked.
- Popup windows are denied. Same-origin popup requests are loaded in the main Aura window instead of creating a new BrowserWindow.
- Sensitive IPC channels check that the sender frame belongs to the trusted Aura origin before executing.
- Permission requests are origin-gated to the Aura origin.
- Device permissions are limited to audio input, audio output, and video input for the Aura origin.
- Logs redact common token/key patterns before writing to disk.

## IPC Surface

Sensitive IPC methods are guarded before they mutate state, open folders, register hotkeys, trigger updates, show notifications, or expose media/screen-share information.

Guarded areas include:

- settings updates;
- login item changes;
- diagnostics report creation/opening;
- manual update actions;
- notification display;
- display source enumeration;
- voice hotkey registration;
- window controls.

Read-only methods such as version/path queries remain low-risk but should still be reviewed before production release.

## Release Readiness

Before production release:

- enable code signing with a real certificate;
- switch stable users to a stable release channel;
- keep alpha/prerelease updates separate from stable builds;
- verify SmartScreen behavior on a signed installer;
- run `npm audit` and review Electron/security advisories;
- review all preload APIs against the web production surface;
- test deep links with malicious/invalid inputs;
- test external link handling with unsafe protocols;
- test media permissions and screen sharing from the production Aura origin.

## Policy

Do not add raw Node.js or Electron objects to `window`.

Do not expose new IPC methods without:

- validating payload shape;
- checking sender trust for sensitive actions;
- logging denied access;
- documenting the bridge API if it is meant for web consumption.
