import { logger } from "../lib/logger";
import { isLoginBlocked } from "../lib/loginBlocker";
import { loginWithPassword, logoutRefreshToken, refreshSession } from "../services/auth.service";
import { getClientIp, getUserAgent } from "../utils/requestMeta";
import { loginBodySchema, refreshTokenBodySchema } from "../validation/schemas";

import type { Request, Response } from "express";

export const authController = {
  async login(req: Request, res: Response) {
    const parsed = loginBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: "Validation failed",
        code: "VALIDATION",
        details: parsed.error.flatten(),
      });
      return;
    }

    const ip = getClientIp(req);
    if (isLoginBlocked(ip)) {
      res.status(429).json({ error: "Too many failed login attempts. Try again later.", code: "RATE_LIMIT" });
      return;
    }

    const userAgent = getUserAgent(req);

    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 16) {
      logger.error({ username: parsed.data.username, ip }, "missing_jwt_secret");
      res.status(500).json({ error: "Authentication configuration invalid", code: "CONFIGURATION_ERROR" });
      return;
    }

    try {
      const result = await loginWithPassword(parsed.data.username, parsed.data.password, { ip, userAgent });
      if (!result.ok) {
        res.status(401).json({ error: "Invalid username or password", code: "INVALID_CREDENTIALS" });
        return;
      }

      res.json({
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        user: result.user,
      });
    } catch (err) {
      logger.error({ err, username: parsed.data.username, ip, userAgent }, "login_request_failed");
      res.status(500).json({ error: "Internal server error", code: "INTERNAL" });
    }
  },

  async refresh(req: Request, res: Response) {
    const parsed = refreshTokenBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: "Validation failed",
        code: "VALIDATION",
        details: parsed.error.flatten(),
      });
      return;
    }

    const ip = getClientIp(req);
    const userAgent = getUserAgent(req);
    const out = await refreshSession(parsed.data.refreshToken, { ip, userAgent });

    if (!out.ok) {
      const status = out.reason === "expired" ? 401 : 401;
      res.status(status).json({ error: "Invalid or expired refresh token", code: "INVALID_REFRESH" });
      return;
    }

    res.json({
      accessToken: out.accessToken,
      refreshToken: out.refreshToken,
    });
  },

  async logout(req: Request, res: Response) {
    const parsed = refreshTokenBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: "Validation failed",
        code: "VALIDATION",
        details: parsed.error.flatten(),
      });
      return;
    }

    const ip = getClientIp(req);
    const userAgent = getUserAgent(req);
    await logoutRefreshToken(parsed.data.refreshToken, {
      userId: req.userId,
      ip,
      userAgent,
    });
    res.status(204).send();
  },
};
