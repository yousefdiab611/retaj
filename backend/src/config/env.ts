import { logger } from "../lib/logger";

/**
 * Validates critical env in production. Call once at process startup (before listen).
 */
const isPostgresUrl = (value: string | undefined): boolean =>
  typeof value === "string" && (value.startsWith("postgresql://") || value.startsWith("postgres://"));

const isSqliteUrl = (value: string | undefined): boolean =>
  typeof value === "string" && value.startsWith("file:");

const isStandaloneDesktop = (): boolean =>
  (process.env.DATABASE_PROVIDER ?? "").toLowerCase() === "sqlite" || isSqliteUrl(process.env.DATABASE_URL);

export function assertProductionEnv(): void {
  if (process.env.NODE_ENV !== "production") return;

  // Standalone desktop POS (Electron + embedded SQLite) deliberately
  // skips the multi-tenant production guards: there is no shared DB,
  // no public origin to lock CORS down to, and the DATABASE_URL is a
  // file:// path on the user's own machine.
  if (isStandaloneDesktop()) {
    const jwt = process.env.JWT_SECRET ?? "";
    if (jwt.length < 32) {
      throw new Error("JWT_SECRET must be at least 32 characters even on desktop");
    }
    return;
  }

  if (!process.env.DATABASE_URL) {
    logger.warn("DATABASE_URL is missing in production; offline fallback mode enabled");
    return;
  }
  if (!isPostgresUrl(process.env.DATABASE_URL)) {
    throw new Error("DATABASE_URL must use PostgreSQL in production (postgresql:// or postgres://)");
  }

  if (!process.env.SHADOW_DATABASE_URL) {
    logger.warn(
      "SHADOW_DATABASE_URL is missing in production; migrations will be skipped until a valid shadow database is configured",
    );
  } else if (!isPostgresUrl(process.env.SHADOW_DATABASE_URL)) {
    throw new Error("SHADOW_DATABASE_URL must use PostgreSQL in production");
  }

  const jwt = process.env.JWT_SECRET ?? "";
  if (jwt.length < 32) {
    throw new Error("JWT_SECRET must be at least 32 characters in production");
  }

  const raw = process.env.ALLOWED_ORIGINS ?? process.env.FRONTEND_ORIGIN;
  if (!raw || raw.trim() === "" || raw === "*") {
    throw new Error("ALLOWED_ORIGINS must list explicit origins in production (not empty or *)");
  }
}

export function validateDevelopmentEnv(): void {
  if (process.env.NODE_ENV === "production") return;

  if (!process.env.DATABASE_URL) {
    logger.warn("DATABASE_URL is missing in development; offline fallback mode enabled");
  } else if (!isPostgresUrl(process.env.DATABASE_URL) && !isSqliteUrl(process.env.DATABASE_URL)) {
    throw new Error("DATABASE_URL must use PostgreSQL or SQLite in development");
  }

  const jwt = process.env.JWT_SECRET ?? "";
  if (jwt.length < 16) {
    throw new Error("JWT_SECRET must be at least 16 characters in development");
  }
}
