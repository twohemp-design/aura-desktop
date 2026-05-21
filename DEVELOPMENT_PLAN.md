# Aura Desktop Development Plan

## Core Rule

`D:\рабочая зона\aura` is the existing Aura web application and must not be changed without explicit approval.

This repository, `D:\рабочая зона\aura exe`, is the dedicated desktop application workspace.

## Product Goal

Build Aura Desktop as a serious PC application, not as a temporary website wrapper.

The target is a Discord-class desktop client:

- stable Windows installer;
- automatic updates;
- native window behavior;
- tray integration;
- system notifications;
- microphone, camera, voice, video, and screen-share support;
- desktop-only hotkeys and push-to-talk;
- deep links;
- crash/log diagnostics;
- future support for richer integrations such as overlay or presence.

## Architecture Decision

Use Electron as the desktop foundation.

Reasons:

- Discord itself uses an Electron-style architecture on Windows.
- Electron gives predictable Chromium behavior for WebRTC, voice, video, screen share, permissions, and media devices.
- Electron has mature support for native notifications, tray, auto updates, installers, preload scripts, and app packaging.
- Tauri is lighter, but it may create unnecessary risk for the exact features that matter most in a Discord-like app.

## High-Level Architecture

```text
Aura Desktop.exe
  -> Electron main process
  -> preload bridge
  -> Aura UI
  -> native desktop integrations

Aura Server / VPS
  -> auth
  -> API
  -> Socket.IO realtime
  -> Supabase
  -> LiveKit token issuing
  -> permissions
  -> push gateway
  -> moderation
```

The desktop client must not contain backend secrets.

Never put these into the exe:

- Supabase service role key;
- LiveKit API secret;
- Redis credentials;
- private push keys;
- production server-only environment values.

## Priority 0: Repository Foundation

Goal: create a professional, maintainable desktop workspace.

Deliverables:

- clear project structure;
- development scripts;
- TypeScript setup;
- Electron main process;
- preload bridge;
- renderer loading strategy;
- environment separation;
- docs for local development.

Initial structure:

```text
aura exe/
  apps/
    desktop/
      src/
        main/
        preload/
        renderer/
      assets/
      package.json
      tsconfig.json
  packages/
    desktop-bridge/
    shared/
  docs/
  DEVELOPMENT_PLAN.md
```

## Priority 1: Minimal Real Desktop App

Goal: launch Aura as a real desktop window with controlled native behavior.

Deliverables:

- Windows desktop window;
- app icon;
- production/dev URL loading strategy;
- safe preload script;
- context isolation enabled;
- no Node.js access in the renderer;
- external links opened in the system browser;
- app menu policy;
- basic logging;
- graceful app lifecycle.

Important: initially load the deployed Aura app or a configured Aura URL. Do not copy or modify the web app.

## Priority 2: Desktop Bridge

Goal: create a clean API between Aura UI and native desktop features.

The renderer should communicate through a controlled bridge, for example:

```ts
window.auraDesktop.app.getVersion();
window.auraDesktop.window.minimize();
window.auraDesktop.window.maximize();
window.auraDesktop.window.close();
window.auraDesktop.notifications.show(...);
window.auraDesktop.system.getPlatform();
```

Rules:

- expose only intentional APIs;
- validate IPC payloads;
- never expose raw Electron or Node APIs;
- keep browser fallback possible later;
- document every desktop bridge capability.

## Priority 3: Installer And Updates

Goal: make Aura install like a normal Windows application.

Deliverables:

- `Aura Setup.exe`;
- install location under user app data;
- Start Menu shortcut;
- desktop shortcut option;
- app icon metadata;
- version metadata;
- auto-update strategy;
- stable/beta/dev release channels later;
- code signing plan.

Preferred tool: `electron-builder` unless a later requirement makes another builder clearly better.

## Priority 4: Native Desktop UX

Goal: make the app feel like a real desktop product.

Deliverables:

- tray icon;
- close-to-tray behavior;
- restore/focus from tray;
- launch on Windows startup;
- native notifications;
- notification click focus behavior;
- unread badge strategy;
- sleep/resume handling;
- network reconnect handling;
- single-instance lock.

## Priority 5: Voice, Video, And Screen Share Hardening

Goal: make communication features reliable on desktop.

Deliverables:

- microphone/camera permission handling;
- device selection persistence;
- screen-share permission and source handling;
- desktop-specific audio behavior;
- push-to-talk foundation;
- mute/deafen hotkeys;
- media diagnostics;
- recovery after device unplug/replug;
- recovery after sleep/resume.

## Priority 6: Desktop Identity And Links

Goal: integrate Aura into Windows and external flows.

Deliverables:

- `aura://` deep links;
- invite links opening in desktop;
- auth redirect handling if needed;
- rich presence foundation;
- file association review;
- protocol security validation.

## Priority 7: Reliability, Security, And Observability

Goal: make the app maintainable after release.

Deliverables:

- crash reporting strategy;
- local diagnostic logs;
- safe log redaction;
- update failure recovery;
- renderer crash recovery;
- CSP review;
- IPC audit;
- dependency audit;
- packaging reproducibility.

## Priority 8: Future Discord-Class Features

These are important but should not block the foundation:

- game overlay;
- advanced rich presence;
- local voice processing modules;
- streamer mode;
- hardware acceleration controls;
- multi-window support;
- advanced notification routing;
- plugin/moderation tooling.

## Development Sequence

1. Create repository foundation.
2. Build the minimal Electron app.
3. Add safe preload and IPC bridge.
4. Add window lifecycle and single-instance behavior.
5. Add installer packaging.
6. Add tray and notifications.
7. Add desktop voice/screen-share hardening.
8. Add deep links and startup integration.
9. Add update channels and release workflow.
10. Expand toward advanced Discord-class features.

## Change Policy

Allowed without extra approval:

- create and edit files inside `D:\рабочая зона\aura exe`;
- add desktop app dependencies inside this workspace;
- write docs for desktop architecture;
- create Electron-specific code;
- create packaging and installer configuration.

Requires explicit approval first:

- any modification inside `D:\рабочая зона\aura`;
- changes to the web app source;
- changes to Aura backend/server code;
- changes to Supabase migrations;
- changes to deployment configuration of the web app;
- storing production credentials locally.

## First Milestone

Milestone name: Desktop Foundation.

Definition of done:

- Aura Desktop project exists in this workspace;
- it launches as a Windows desktop app;
- it loads a configured Aura URL;
- Electron security basics are enabled;
- preload bridge exists;
- app has a real icon placeholder strategy;
- development and build commands are documented;
- no web-version files were modified.
