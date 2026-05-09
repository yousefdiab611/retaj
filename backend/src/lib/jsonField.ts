/**
 * Bridge for fields that are `Json` on PostgreSQL and `String` on the
 * SQLite desktop schema. The rest of the codebase reads/writes plain
 * JS objects; these helpers normalise the on-disk representation so the
 * services layer never has to know which database is underneath.
 *
 * Read side  : `parseJsonField(value)` returns `null` on empty/invalid
 *              input rather than throwing, which matches the prior
 *              Prisma `Json?` behaviour callers were already coding for.
 * Write side : `serializeJsonField(value)` returns the value untouched
 *              when running against PostgreSQL (Prisma takes the object
 *              directly), and JSON-encodes it for SQLite. Direction is
 *              detected via DATABASE_PROVIDER.
 *
 * `tags`-style scalar arrays follow the same pattern via
 * `parseJsonArrayField` / `serializeJsonArrayField`.
 */

const PROVIDER = (process.env.DATABASE_PROVIDER ?? "postgresql").toLowerCase();
const IS_SQLITE = PROVIDER === "sqlite";

export const isSqliteProvider = (): boolean => IS_SQLITE;

export function parseJsonField<T = unknown>(value: unknown): T | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") {
    if (value.length === 0) return null;
    try {
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  }
  return value as T;
}

export function serializeJsonField(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (!IS_SQLITE) return value;
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

export function parseJsonArrayField<T = unknown>(value: unknown): T[] {
  const parsed = parseJsonField<T[]>(value);
  if (Array.isArray(parsed)) return parsed;
  return [];
}

export function serializeJsonArrayField(value: readonly unknown[] | null | undefined): unknown {
  if (!IS_SQLITE) return value ?? undefined;
  if (!value) return "[]";
  return JSON.stringify(value);
}
