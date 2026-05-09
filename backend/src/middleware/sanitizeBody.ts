import type { NextFunction, Request, Response } from "express";

const preserveKeys = new Set(["password", "refreshToken", "currentPassword", "newPassword"]);

function deepTrimValue(value: unknown): unknown {
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) return value.map((v) => deepTrimValue(v));
  if (value !== null && typeof value === "object") {
    const o = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(o)) {
      const v = o[k];
      if (preserveKeys.has(k)) {
        out[k] = v;
      } else {
        out[k] = deepTrimValue(v);
      }
    }
    return out;
  }
  return value;
}

/** Trims string fields recursively on JSON bodies (skips password-like fields). */
export function sanitizeBody(req: Request, _res: Response, next: NextFunction) {
  if (req.body !== null && req.body !== undefined && typeof req.body === "object") {
    req.body = deepTrimValue(req.body) as typeof req.body;
  }
  next();
}
