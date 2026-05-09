import { PrismaClient } from "@prisma/client";
import type { Prisma } from "@prisma/client";

import { logger } from "./logger";
import { DatabaseUnavailableError, isDatabaseConnectionError } from "./errors";

const globalForPrisma = globalThis as unknown as { rawPrisma: PrismaClient | undefined };

export const rawPrisma =
  globalForPrisma.rawPrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.rawPrisma = rawPrisma;
}

function createSafePrisma<T extends object>(target: T): T {
  const handler: ProxyHandler<any> = {
    get(targetObj, property, receiver) {
      const value = Reflect.get(targetObj, property, receiver);
      if (typeof value === "function") {
        return (...args: unknown[]) => {
          try {
            const result = value.apply(targetObj, args);
            if (result instanceof Promise) {
              return result.catch(handlePrismaError);
            }
            return result;
          } catch (err) {
            throw handlePrismaError(err);
          }
        };
      }

      if (value && typeof value === "object") {
        return new Proxy(value, handler);
      }

      return value;
    },
  };

  return new Proxy(target, handler);
}

function handlePrismaError(error: unknown): never {
  if (isDatabaseConnectionError(error)) {
    logger.warn({ err: error }, "prisma_connection_unavailable");
    throw new DatabaseUnavailableError("Database unavailable");
  }
  throw error;
}

export const prisma = createSafePrisma(rawPrisma);
