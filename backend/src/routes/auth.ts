import { Router } from "express";

import { authController } from "../controllers/authController";
import { loginRateLimiter } from "../middleware/loginRateLimit";
import { refreshRateLimiter } from "../middleware/rateLimits";

export const authRouter = Router();

authRouter.post("/login", loginRateLimiter, (req, res) => void authController.login(req, res));
authRouter.post("/refresh", refreshRateLimiter, (req, res) => void authController.refresh(req, res));
authRouter.post("/logout", refreshRateLimiter, (req, res) => void authController.logout(req, res));
