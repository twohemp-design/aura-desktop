# Aura Desktop Diagnostics

Aura Desktop has a native diagnostics layer that does not require changes in the Aura web application.

## Purpose

The diagnostics report is intended for development and support:

- verify the desktop shell version and environment;
- inspect window and renderer state;
- inspect update status;
- inspect tray/startup/settings state;
- inspect registered voice hotkeys;
- inspect screen-share source availability;
- include recent redacted desktop logs.

## User-Facing Entry Points

Diagnostics can be reached from the tray menu:

- `Диагностика -> Создать отчет`
- `Диагностика -> Открыть папку отчетов`

Reports are written under the app `userData` directory:

```text
diagnostics/aura-diagnostics-<timestamp>.json
```

## Bridge API

The preload bridge exposes diagnostics methods for future production UI integration:

```ts
window.auraDesktop.diagnostics.getReport();
window.auraDesktop.diagnostics.writeReport();
window.auraDesktop.diagnostics.openFolder();
window.auraDesktop.diagnostics.readRecentLog();
window.auraDesktop.diagnostics.getLogFilePath();
```

## Privacy

Diagnostics are local JSON files. The app does not upload them automatically.

Logs are passed through the desktop logger redaction path before being written. The diagnostics report should still be treated as potentially sensitive because it can include local paths, display names, update errors, and recent operational logs.
