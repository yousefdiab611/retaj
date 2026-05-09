import { exec } from "child_process";
import fs from "fs";
import path from "path";
import { promisify } from "util";

import { rawPrisma } from "./prisma";
import { logger } from "./logger";
import { isDatabaseConnectionError } from "./errors";

const execAsync = promisify(exec);
const RECOVERY_INTERVAL_MS = Number(process.env.DB_RECOVERY_INTERVAL_MS ?? 10_000);
const DOCKER_RECOVERY_ENABLED = process.env.DB_DOCKER_RECOVERY !== "0";
const DOCKER_COMPOSE_FILE = path.resolve(process.cwd(), "docker-compose.yml");

export type SyncEngineStatus = "ACTIVE" | "QUEUED";
export type PrismaStatus = "READY" | "FALLBACK";
export type DatabaseProvider = "postgresql" | "sqlite" | "none" | "unknown";

export interface DatabaseStatus {
  online: boolean;
  provider: DatabaseProvider;
  prismaStatus: PrismaStatus;
  syncEngineStatus: SyncEngineStatus;
  lastError?: string;
}

const status: DatabaseStatus = {
  online: false,
  provider: "none",
  prismaStatus: "FALLBACK",
  syncEngineStatus: "QUEUED",
};

let recoveryTimer: NodeJS.Timeout | null = null;
let bootstrapCompleted = false;

export function getDatabaseStatus(): DatabaseStatus {
  return { ...status };
}

export function isDatabaseOnline(): boolean {
  return status.online;
}

export function hasBootstrapCompleted(): boolean {
  return bootstrapCompleted;
}

export async function initDatabaseBootstrap(): Promise<void> {
  logger.info("starting database bootstrap");

  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    logger.warn("DATABASE_URL is missing; enabling offline fallback mode");
    status.provider = "sqlite";
    status.online = false;
    status.prismaStatus = "FALLBACK";
    status.syncEngineStatus = "QUEUED";
    status.lastError = "DATABASE_URL not configured";
    bootstrapCompleted = true;
    startRecoveryWatcher();
    return;
  }

  if (url.startsWith("postgresql://") || url.startsWith("postgres://")) {
    status.provider = "postgresql";
    await initializePostgres();
  } else {
    logger.warn({ url }, "Unsupported DATABASE_URL provider; starting offline fallback mode");
    status.provider = "none";
    status.online = false;
    status.prismaStatus = "FALLBACK";
    status.syncEngineStatus = "QUEUED";
    status.lastError = "Unsupported database provider";
  }

  bootstrapCompleted = true;
  startRecoveryWatcher();
}

async function initializePostgres(): Promise<void> {
  try {
    logger.info("attempting PostgreSQL connection");
    await rawPrisma.$connect();
    await rawPrisma.$queryRaw`SELECT 1`;

    status.online = true;
    status.prismaStatus = "READY";
    status.syncEngineStatus = "ACTIVE";
    status.lastError = undefined;

    logger.info("PostgreSQL connection established");
    await runPrismaBootstrap();
  } catch (error) {
    status.online = false;
    status.prismaStatus = "FALLBACK";
    status.syncEngineStatus = "QUEUED";
    status.lastError = error instanceof Error ? error.message : String(error);

    logger.warn({ err: error }, "PostgreSQL unavailable; starting in offline fallback mode");
    await attemptDockerRecovery();
  }
}

async function runPrismaBootstrap(): Promise<void> {
  const schema = process.env.NODE_ENV === "production" ? "prisma/schema.postgresql.prisma" : "prisma/schema.prisma";
  const cwd = process.cwd();
  logger.info({ schema }, "running Prisma bootstrap commands");

  try {
    const prismaClientDir = path.join(cwd, "node_modules", ".prisma", "client");
    if (!fs.existsSync(prismaClientDir)) {
      await execAsync(`npx prisma generate --schema "${schema}"`, { cwd, windowsHide: true });
    } else {
      logger.info("Prisma client already generated; skipping runtime generation");
    }

    if (process.env.NODE_ENV === "production") {
      await execAsync(`npx prisma migrate deploy --schema "${schema}"`, { cwd, windowsHide: true });
    } else {
      await execAsync(`npx prisma db push --schema "${schema}"`, { cwd, windowsHide: true });
    }
    logger.info("Prisma bootstrap completed");
  } catch (error) {
    logger.warn({ err: error }, "Prisma bootstrap failed; continuing with existing client if available");
  }
}

async function attemptDockerRecovery(): Promise<void> {
  if (!DOCKER_RECOVERY_ENABLED) {
    logger.debug("Docker auto-recovery disabled");
    return;
  }

  try {
    await execAsync("docker compose version", { windowsHide: true });
  } catch {
    logger.debug("Docker is not available for auto recovery");
    return;
  }

  if (!fs.existsSync(DOCKER_COMPOSE_FILE)) {
    logger.warn({ file: DOCKER_COMPOSE_FILE }, "docker-compose.yml not found for optional recovery");
    return;
  }

  try {
    logger.info({ file: DOCKER_COMPOSE_FILE }, "attempting optional Docker recovery");
    await execAsync(`docker compose -f "${DOCKER_COMPOSE_FILE}" up -d postgres`, {
      cwd: path.dirname(DOCKER_COMPOSE_FILE),
      windowsHide: true,
    });
    logger.info("Docker postgres recovery command issued");
  } catch (error) {
    logger.warn({ err: error }, "Docker auto-recovery command failed");
  }
}

function startRecoveryWatcher(): void {
  if (recoveryTimer) return;

  recoveryTimer = setInterval(async () => {
    if (status.online) return;

    logger.debug("database recovery watcher pinging database");
    const connected = await pingDatabase();
    if (!connected) return;

    status.online = true;
    status.prismaStatus = "READY";
    status.syncEngineStatus = "ACTIVE";
    status.lastError = undefined;

    logger.info("PostgreSQL recovered; switching back to online mode");
    await runPrismaBootstrap();
  }, RECOVERY_INTERVAL_MS);

  recoveryTimer.unref();
}

export async function pingDatabase(): Promise<boolean> {
  try {
    await rawPrisma.$connect();
    await rawPrisma.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    status.online = false;
    status.prismaStatus = "FALLBACK";
    status.syncEngineStatus = "QUEUED";
    status.lastError = error instanceof Error ? error.message : String(error);
    logger.debug({ err: error }, "database ping failed");
    return false;
  }
}
