import { session, shell, type PermissionRequest } from "electron";
import { log } from "./logger";

const ALLOWED_PERMISSION_REQUESTS = new Set([
  "display-capture",
  "fullscreen",
  "media",
  "notifications",
  "openExternal",
  "speaker-selection",
]);

const ALLOWED_PERMISSION_CHECKS = new Set([
  "fullscreen",
  "media",
  "notifications",
  "openExternal",
  "speaker-selection",
]);

const normalizeOrigin = (value: string) => {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
};

const getRequestOrigin = (details: PermissionRequest) => {
  if ("requestingUrl" in details && typeof details.requestingUrl === "string") {
    return normalizeOrigin(details.requestingUrl);
  }

  if ("embeddingOrigin" in details && typeof details.embeddingOrigin === "string") {
    return normalizeOrigin(details.embeddingOrigin);
  }

  return null;
};

export const configureSecurityPolicy = (auraUrl: string) => {
  const auraOrigin = normalizeOrigin(auraUrl);

  if (!auraOrigin) {
    throw new Error(`Invalid Aura URL: ${auraUrl}`);
  }

  session.defaultSession.setPermissionCheckHandler((_webContents, permission, requestingOrigin) => {
    const origin = normalizeOrigin(requestingOrigin);
    const allowed = origin === auraOrigin && ALLOWED_PERMISSION_CHECKS.has(permission);

    if (!allowed) {
      log("warn", "[security] denied permission check", { permission, requestingOrigin });
    }

    return allowed;
  });

  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback, details) => {
    const origin = getRequestOrigin(details);
    const allowed = origin === auraOrigin && ALLOWED_PERMISSION_REQUESTS.has(permission);

    if (!allowed) {
      log("warn", "[security] denied permission request", { permission, origin });
    }

    callback(allowed);
  });

  session.defaultSession.setDevicePermissionHandler((details) => {
    const origin = normalizeOrigin(details.origin);
    const allowed = origin === auraOrigin && ["audioinput", "audiooutput", "videoinput"].includes(details.deviceType);

    if (!allowed) {
      log("warn", "[security] denied device permission", {
        deviceType: details.deviceType,
        origin: details.origin,
      });
    }

    return allowed;
  });

  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    if (details.resourceType !== "mainFrame") {
      callback({});
      return;
    }

    const targetOrigin = normalizeOrigin(details.url);

    if (targetOrigin === auraOrigin) {
      callback({});
      return;
    }

    log("warn", "[security] blocked main frame navigation", details.url);
    void shell.openExternal(details.url);
    callback({ cancel: true });
  });
};
