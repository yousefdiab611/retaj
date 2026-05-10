import fs from "fs";
import path from "path";

import pino from "pino";

const isDev = process.env.NODE_ENV !== "production";
const defaultLogFilePath = path.join(process.cwd(), "logs", "retaj-api.log");
const requestedLogFilePath = process.env.LOG_FILE_PATH ?? defaultLogFilePath;

/**
 * Probe the requested log destination. We fall back to stdout-only logging
 * if the directory cannot be created or the file cannot be opened for append.
 *
 * This protects packaged desktop builds whose cwd lives under Program Files
 * (read-only on Windows), and lets the parent Electron main process continue
 * capturing the backend's stdout/stderr.
 */
function resolveLogFilePath(target: string): string | null {
  try {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    const fd = fs.openSync(target, "a");
    fs.closeSync(fd);
    return target;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(
      `[logger] file logging disabled (${target}): ${(err as Error).message}. Falling back to stdout.`,
    );
    return null;
  }
}

const resolvedLogFilePath = resolveLogFilePath(requestedLogFilePath);

const targets: Array<{
  target: string;
  level?: string;
  options?: Record<string, unknown>;
}> = [];

if (isDev && process.env.LOG_PRETTY !== "0") {
  targets.push({
    target: "pino-pretty",
    level: process.env.LOG_LEVEL ?? "debug",
    options: { colorize: true },
  });
}

if (resolvedLogFilePath) {
  targets.push({
    target: "pino/file",
    level: process.env.LOG_LEVEL ?? (isDev ? "debug" : "info"),
    options: { destination: resolvedLogFilePath },
  });
}

// Always emit to stdout when no file destination is available so the parent
// process (e.g. Electron main, Docker, PM2) can still capture diagnostics.
if (!resolvedLogFilePath) {
  targets.push({
    target: "pino/file",
    level: process.env.LOG_LEVEL ?? (isDev ? "debug" : "info"),
    options: { destination: 1 },
  });
}

const transport = pino.transport({ targets });
transport.on("error", (err: unknown) => {
  // eslint-disable-next-line no-console
  console.warn(`[logger] transport error: ${(err as Error).message}`);
});

export const logger = pino(
  {
    level: process.env.LOG_LEVEL ?? (isDev ? "debug" : "info"),
  },
  transport,
);
