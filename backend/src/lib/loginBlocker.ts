import { getRedis, isRedisConfigured } from "./redis";

const MAX_ATTEMPTS = Math.max(1, Number(process.env.AUTH_LOGIN_MAX_ATTEMPTS ?? 10));
const WINDOW_MS = Math.max(60_000, Number(process.env.AUTH_LOGIN_WINDOW_MS ?? 15 * 60 * 1000));
const BLOCK_DURATION_MS =
  Math.max(5, Number(process.env.AUTH_BLOCK_DURATION_MINUTES ?? 30)) * 60 * 1000;

interface MemoryEntry {
  count: number;
  startedAt: number;
  blockedUntil?: number;
}

const memory = new Map<string, MemoryEntry>();

function getKey(ip?: string): string {
  return ip?.trim() || "unknown";
}

function nsKey(ip: string): string {
  return `retaj:loginblock:${ip}`;
}

async function memIsBlocked(key: string): Promise<boolean> {
  const entry = memory.get(key);
  if (!entry) return false;
  if (entry.blockedUntil && entry.blockedUntil > Date.now()) return true;
  if (entry.blockedUntil) memory.delete(key);
  return false;
}

async function memReportFailure(key: string): Promise<void> {
  const now = Date.now();
  const entry = memory.get(key);
  if (!entry || now - entry.startedAt > WINDOW_MS) {
    memory.set(key, { count: 1, startedAt: now });
    return;
  }
  const nextCount = entry.count + 1;
  if (nextCount >= MAX_ATTEMPTS) {
    memory.set(key, { count: nextCount, startedAt: entry.startedAt, blockedUntil: now + BLOCK_DURATION_MS });
    return;
  }
  memory.set(key, { ...entry, count: nextCount });
}

async function redisIsBlocked(client: NonNullable<Awaited<ReturnType<typeof getRedis>>>, key: string): Promise<boolean> {
  const blockedUntil = await client.get(`${nsKey(key)}:blockedUntil`);
  if (!blockedUntil) return false;
  return Number(blockedUntil) > Date.now();
}

async function redisReportFailure(client: NonNullable<Awaited<ReturnType<typeof getRedis>>>, key: string): Promise<void> {
  const counterKey = `${nsKey(key)}:count`;
  const blockedKey = `${nsKey(key)}:blockedUntil`;
  const count = await client.incr(counterKey);
  if (count === 1) {
    await client.pExpire(counterKey, WINDOW_MS);
  }
  if (count >= MAX_ATTEMPTS) {
    await client.set(blockedKey, String(Date.now() + BLOCK_DURATION_MS), {
      PX: BLOCK_DURATION_MS,
    });
  }
}

async function redisReportSuccess(client: NonNullable<Awaited<ReturnType<typeof getRedis>>>, key: string): Promise<void> {
  await client.del(`${nsKey(key)}:count`);
  await client.del(`${nsKey(key)}:blockedUntil`);
}

/**
 * NOTE: the surface stays synchronous for backwards compatibility with the
 * existing call sites. When Redis is unreachable we transparently degrade to
 * the in-process map.
 */
export function isLoginBlocked(ip?: string): boolean {
  const key = getKey(ip);
  if (isRedisConfigured()) {
    void getRedis().then(async (client) => {
      if (!client) return;
      try {
        const blocked = await redisIsBlocked(client, key);
        if (blocked) {
          memory.set(key, {
            count: MAX_ATTEMPTS,
            startedAt: Date.now(),
            blockedUntil: Date.now() + BLOCK_DURATION_MS,
          });
        }
      } catch {
        /* swallow */
      }
    });
  }

  // memory check is sync and authoritative for this call.
  const entry = memory.get(key);
  if (!entry) return false;
  if (entry.blockedUntil && entry.blockedUntil > Date.now()) return true;
  if (entry.blockedUntil) memory.delete(key);
  return false;
}

export function reportLoginFailure(ip?: string): void {
  const key = getKey(ip);
  void memReportFailure(key);
  if (isRedisConfigured()) {
    void getRedis().then((client) => {
      if (client) void redisReportFailure(client, key).catch(() => {});
    });
  }
}

export function reportLoginSuccess(ip?: string): void {
  const key = getKey(ip);
  memory.delete(key);
  if (isRedisConfigured()) {
    void getRedis().then((client) => {
      if (client) void redisReportSuccess(client, key).catch(() => {});
    });
  }
}

// Exported for tests only.
export const __testing = { memory, MAX_ATTEMPTS, WINDOW_MS, BLOCK_DURATION_MS, memIsBlocked };
