import rateLimit from "express-rate-limit";

const jsonErr = (msg: string, code: string) => ({ error: msg, code });

export const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Math.max(50, Number(process.env.API_RATE_MAX ?? 800)),
  standardHeaders: true,
  legacyHeaders: false,
  message: jsonErr("Too many requests", "RATE_LIMIT"),
});

export const refreshRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: Math.max(10, Number(process.env.AUTH_REFRESH_MAX ?? 60)),
  standardHeaders: true,
  legacyHeaders: false,
  message: jsonErr("Too many token requests", "RATE_LIMIT"),
});

export const sensitiveWriteRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Math.max(20, Number(process.env.API_WRITE_MAX ?? 400)),
  standardHeaders: true,
  legacyHeaders: false,
  message: jsonErr("Too many write requests", "RATE_LIMIT"),
});
