import { app } from "electron";
import fs from "node:fs";
import path from "node:path";
import util from "node:util";

const LOG_FILE = "aura-desktop.log";
const MAX_LOG_BYTES = 1024 * 1024;

let initialized = false;
let logFilePath = "";

const redact = (message: string) => (
  message
    .replace(/(access_token|refresh_token|service_role|api[_-]?key|authorization)=([^&\s]+)/gi, "$1=[redacted]")
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [redacted]")
);

const formatValue = (value: unknown) => {
  if (value instanceof Error) {
    return `${value.name}: ${value.message}\n${value.stack || ""}`;
  }

  if (typeof value === "string") {
    return value;
  }

  return util.inspect(value, { depth: 4, breakLength: 120 });
};

const rotateIfNeeded = () => {
  try {
    const stat = fs.statSync(logFilePath);

    if (stat.size < MAX_LOG_BYTES) {
      return;
    }

    fs.renameSync(logFilePath, `${logFilePath}.1`);
  } catch {
    // Log rotation should never block app startup.
  }
};

export const initializeLogger = () => {
  if (initialized) {
    return;
  }

  logFilePath = path.join(app.getPath("userData"), "logs", LOG_FILE);
  fs.mkdirSync(path.dirname(logFilePath), { recursive: true });
  rotateIfNeeded();
  initialized = true;
};

export const log = (level: "info" | "warn" | "error", ...values: unknown[]) => {
  initializeLogger();

  const timestamp = new Date().toISOString();
  const message = redact(values.map(formatValue).join(" "));
  const line = `[${timestamp}] [${level}] ${message}\n`;

  try {
    fs.appendFileSync(logFilePath, line, "utf8");
  } catch {
    // Keep logging best-effort.
  }

  if (level === "error") {
    console.error(...values);
  } else if (level === "warn") {
    console.warn(...values);
  } else {
    console.log(...values);
  }
};

export const getLogFilePath = () => {
  initializeLogger();

  return logFilePath;
};

export const readRecentLog = (maxBytes = 64 * 1024) => {
  initializeLogger();

  try {
    const stat = fs.statSync(logFilePath);
    const start = Math.max(0, stat.size - maxBytes);
    const buffer = Buffer.alloc(stat.size - start);
    const fd = fs.openSync(logFilePath, "r");
    fs.readSync(fd, buffer, 0, buffer.length, start);
    fs.closeSync(fd);

    return buffer.toString("utf8");
  } catch {
    return "";
  }
};
