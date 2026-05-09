import fs from "fs";
import path from "path";
import pino from "pino";

const isDev = process.env.NODE_ENV !== "production";
const logFilePath = process.env.LOG_FILE_PATH ?? path.join(process.cwd(), "logs", "retaj-api.log");

try {
  fs.mkdirSync(path.dirname(logFilePath), { recursive: true });
} catch {
  // best effort
}

const targets = [] as Array<{
  target: string;
  level?: string;
  options?: Record<string, unknown>;
}>;

if (isDev && process.env.LOG_PRETTY !== "0") {
  targets.push({ target: "pino-pretty", level: process.env.LOG_LEVEL ?? "debug", options: { colorize: true } });
}

targets.push({ target: "pino/file", level: process.env.LOG_LEVEL ?? (isDev ? "debug" : "info"), options: { destination: logFilePath } });

export const logger = pino(
  {
    level: process.env.LOG_LEVEL ?? (isDev ? "debug" : "info"),
  },
  pino.transport({ targets }),
);
