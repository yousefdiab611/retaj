import dotenv from "dotenv";
import "express-async-errors";

import { assertProductionEnv, validateDevelopmentEnv } from "./config/env";
import { createApp } from "./createApp";
import { initDatabaseBootstrap, getDatabaseStatus } from "./lib/dbBootstrap";
import { logger } from "./lib/logger";
import { initObservability } from "./lib/observability";
import { rawPrisma } from "./lib/prisma";

const envFile = process.env.NODE_ENV === "production" ? ".env.production" : ".env.development";
const envResult = dotenv.config({ path: envFile });
if (envResult.error) {
  // Fall back to a generic .env if the env-specific file is missing.
  dotenv.config();
}

assertProductionEnv();
validateDevelopmentEnv();

const SHUTDOWN_TIMEOUT_MS = Number(process.env.SHUTDOWN_TIMEOUT_MS ?? 25_000);

async function main(): Promise<void> {
  initObservability();
  await initDatabaseBootstrap();
  const status = getDatabaseStatus();
  logger.info({ dbStatus: status }, "startup_health_check");

  const port = Number(process.env.PORT) || 3001;
  const app = createApp();

  process.on("unhandledRejection", (reason) => {
    logger.error({ reason }, "unhandled_promise_rejection");
  });
  process.on("uncaughtException", (err) => {
    logger.fatal({ err }, "uncaught_exception");
    process.exit(1);
  });

  const server = app.listen(port, () => {
    logger.info({ port }, "API listening");
  });

  const shutdown = (signal: NodeJS.Signals) => {
    logger.info({ signal }, "shutdown_initiated");

    const force = setTimeout(() => {
      logger.error({ signal }, "shutdown_forced_timeout");
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);
    force.unref();

    server.close(async (err) => {
      if (err) {
        logger.error({ err }, "shutdown_server_close_error");
      }
      try {
        await rawPrisma.$disconnect();
      } catch (disconnectErr) {
        logger.error({ err: disconnectErr }, "shutdown_prisma_disconnect_error");
      }
      logger.info({ signal }, "shutdown_complete");
      process.exit(err ? 1 : 0);
    });
  };

  for (const signal of ["SIGINT", "SIGTERM"] as NodeJS.Signals[]) {
    process.on(signal, () => shutdown(signal));
  }
}

main().catch((err) => {
  logger.fatal({ err }, "startup_failed");
  process.exit(1);
});
