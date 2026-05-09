import type { Request } from "express";

export function getClientIp(req: Request): string | undefined {
  const xf = req.headers["x-forwarded-for"];
  if (typeof xf === "string") {
    const first = xf.split(",")[0]?.trim();
    return first || undefined;
  }
  if (Array.isArray(xf) && xf[0]) {
    return xf[0].trim();
  }
  return req.socket?.remoteAddress ?? undefined;
}

export function getUserAgent(req: Request): string | undefined {
  const ua = req.headers["user-agent"];
  return typeof ua === "string" ? ua.slice(0, 512) : undefined;
}

export function firstPathParam(param: string | string[] | undefined): string {
  if (Array.isArray(param)) return param[0] ?? "";
  return param ?? "";
}
