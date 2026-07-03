import { logger } from "./logger";

import type { NextFunction, Request, Response } from "express";

/**
 * Lazily initialised Sentry instance. We avoid importing @sentry/node at the
 * module top level so the dependency stays optional (the project keeps
 * working without a DSN configured).
 */
let sentryRef: typeof import("@sentry/node") | null = null;

export function initObservability(): void {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    logger.info("sentry_disabled (no SENTRY_DSN set)");
    return;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Sentry = require("@sentry/node") as typeof import("@sentry/node");
    Sentry.init({
      dsn,
      environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV ?? "development",
      release: process.env.APP_RELEASE ?? process.env.npm_package_version,
      tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0.1),
      profilesSampleRate: Number(process.env.SENTRY_PROFILES_SAMPLE_RATE ?? 0),
      sendDefaultPii: false,
      ignoreErrors: ["DatabaseUnavailableError", /AbortError/, /TimeoutError/, "RATE_LIMIT"],
    });
    sentryRef = Sentry;
    logger.info({ environment: process.env.SENTRY_ENVIRONMENT }, "sentry_initialised");
  } catch (err) {
    logger.warn({ err }, "sentry_init_skipped (package missing)");
  }
}

export function captureException(err: unknown, context?: Record<string, unknown>): void {
  if (!sentryRef) return;
  sentryRef.withScope((scope) => {
    if (context) {
      for (const [key, value] of Object.entries(context)) {
        scope.setExtra(key, value);
      }
    }
    sentryRef!.captureException(err);
  });
}

/**
 * Express error middleware that forwards 500-class errors to Sentry without
 * altering the response shape. Plug in just before the existing error
 * formatter in createApp.
 */
export function sentryRequestHandler() {
  return function sentryReq(req: Request, _res: Response, next: NextFunction) {
    if (!sentryRef) return next();
    sentryRef.withScope((scope) => {
      scope.setTag("requestId", req.requestId ?? "unknown");
      scope.setTag("method", req.method);
      scope.setExtra("url", req.originalUrl);
      next();
    });
  };
}

export function sentryErrorHandler() {
  return function sentryErr(err: unknown, _req: Request, _res: Response, next: NextFunction) {
    captureException(err);
    next(err);
  };
}
