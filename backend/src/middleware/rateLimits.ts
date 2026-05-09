import rateLimit, { type Store } from "express-rate-limit";

import { getRedis, isRedisConfigured } from "../lib/redis";
import { logger } from "../lib/logger";

const jsonErr = (msg: string, code: string) => ({ error: msg, code });

/**
 * Build a `RedisStore` lazily. We resolve the client on demand so unit tests
 * (and dev environments without Redis) keep using the default in-memory store.
 */
function maybeRedisStore(prefix: string): Store | undefined {
  if (!isRedisConfigured()) return undefined;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const RedisStore = require("rate-limit-redis").default as new (...args: unknown[]) => Store;
    return new RedisStore({
      // sendCommand wraps the redis client we control. The rate-limit-redis
      // adapter pings the client lazily, so initialisation cost is one-shot.
      sendCommand: async (...args: unknown[]) => {
        const c = await getRedis();
        if (!c) throw new Error("redis_unavailable");
        return (c as unknown as { sendCommand: (a: unknown[]) => Promise<unknown> }).sendCommand(args);
      },
      prefix: `retaj:rl:${prefix}:`,
    });
  } catch (err) {
    logger.warn({ err }, "rate_limit_redis_store_unavailable");
    return undefined;
  }
}

export const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Math.max(50, Number(process.env.API_RATE_MAX ?? 800)),
  standardHeaders: true,
  legacyHeaders: false,
  store: maybeRedisStore("api"),
  message: jsonErr("Too many requests", "RATE_LIMIT"),
});

export const refreshRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: Math.max(10, Number(process.env.AUTH_REFRESH_MAX ?? 60)),
  standardHeaders: true,
  legacyHeaders: false,
  store: maybeRedisStore("refresh"),
  message: jsonErr("Too many token requests", "RATE_LIMIT"),
});

export const sensitiveWriteRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Math.max(20, Number(process.env.API_WRITE_MAX ?? 400)),
  standardHeaders: true,
  legacyHeaders: false,
  store: maybeRedisStore("write"),
  message: jsonErr("Too many write requests", "RATE_LIMIT"),
});
