import { randomUUID } from "crypto";

import type { NextFunction, Request, Response } from "express";

import { logger } from "../lib/logger";

const REQUEST_ID_HEADER = "x-request-id";

declare module "express-serve-static-core" {
  interface Request {
    requestId: string;
    startedAt: number;
  }
}

/**
 * Attaches a request id and timing data to every request, mirrors the id back
 * in `x-request-id` and emits a structured access log on completion. Combined
 * with pino's child logger this becomes the foundation for tracing.
 */
export function requestContext(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.header(REQUEST_ID_HEADER);
  const requestId = incoming && /^[A-Za-z0-9_-]{6,128}$/.test(incoming) ? incoming : randomUUID();

  req.requestId = requestId;
  req.startedAt = Date.now();
  res.setHeader(REQUEST_ID_HEADER, requestId);

  res.on("finish", () => {
    const durationMs = Date.now() - req.startedAt;
    const userId = req.userId ?? null;
    const tenantId = req.userTenantId ?? null;
    const status = res.statusCode;
    const level = status >= 500 ? "error" : status >= 400 ? "warn" : "info";

    logger[level](
      {
        requestId,
        method: req.method,
        url: req.originalUrl,
        status,
        durationMs,
        userId,
        tenantId,
        ip: req.ip,
      },
      "http_request",
    );
  });

  next();
}
