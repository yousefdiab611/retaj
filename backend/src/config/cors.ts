import type { CorsOptions } from "cors";

/**
 * ALLOWED_ORIGINS or FRONTEND_ORIGIN: comma-separated list.
 * Include web (Vite), Expo dev server, Electron, and mobile bundler URLs as needed.
 * In production, assertProductionEnv() requires explicit origins.
 */
export function getCorsOrigin(): CorsOptions["origin"] {
  const raw = process.env.ALLOWED_ORIGINS ?? process.env.FRONTEND_ORIGIN;
  if (!raw || raw === "*") {
    return process.env.NODE_ENV === "production" ? false : true;
  }
  const list = raw
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  return list.length === 0 ? true : list;
}
