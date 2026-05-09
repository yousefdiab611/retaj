import type { RedisClientType } from "redis";

import { logger } from "./logger";

let client: RedisClientType | null = null;
let connecting: Promise<RedisClientType | null> | null = null;

export function isRedisConfigured(): boolean {
  return Boolean(process.env.REDIS_URL);
}

/**
 * Lazily-resolved Redis client. Returns null when REDIS_URL is unset OR the
 * `redis` package is missing OR the connection fails. Callers must always be
 * prepared to fall back to in-process state.
 */
export async function getRedis(): Promise<RedisClientType | null> {
  if (client) return client;
  if (!isRedisConfigured()) return null;
  if (connecting) return connecting;

  connecting = (async () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const redisLib = require("redis") as typeof import("redis");
      const c = redisLib.createClient({ url: process.env.REDIS_URL });
      c.on("error", (err) => logger.warn({ err }, "redis_client_error"));
      await c.connect();
      client = c as unknown as RedisClientType;
      logger.info("redis_connected");
      return client;
    } catch (err) {
      logger.warn({ err }, "redis_unavailable_falling_back_to_memory");
      client = null;
      return null;
    } finally {
      connecting = null;
    }
  })();

  return connecting;
}

export async function closeRedis(): Promise<void> {
  if (!client) return;
  try {
    await client.quit();
  } catch (err) {
    logger.warn({ err }, "redis_close_error");
  } finally {
    client = null;
  }
}
