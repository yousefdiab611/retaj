import dotenv from "dotenv";
import "express-async-errors";

import { assertProductionEnv, validateDevelopmentEnv } from "./config/env";
import { createApp } from "./createApp";
import { logger } from "./lib/logger";
import { initDatabaseBootstrap, getDatabaseStatus } from "./lib/dbBootstrap";

const envFile = process.env.NODE_ENV === "production" ? ".env.production" : ".env.development";
const envResult = dotenv.config({ path: envFile });
if (envResult.error) {
  console.warn(`Unable to load ${envFile}. Falling back to .env.`);
  dotenv.config();
}

assertProductionEnv();
validateDevelopmentEnv();

async function main(): Promise<void> {
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

  app.listen(port, () => {
    logger.info({ port }, "API listening");
  });
}

main().catch((err) => {
  logger.fatal({ err }, "startup_failed");
  process.exit(1);
});
