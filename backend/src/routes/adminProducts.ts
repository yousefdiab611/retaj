import { Router } from "express";

import { adminProductController } from "../controllers/adminProductController";
import { sensitiveWriteRateLimiter } from "../middleware/rateLimits";

export const adminProductsRouter = Router();

adminProductsRouter.get("/", (req, res) => void adminProductController.list(req, res));
adminProductsRouter.post("/", sensitiveWriteRateLimiter, (req, res) =>
  void adminProductController.create(req, res),
);
adminProductsRouter.patch("/:id", sensitiveWriteRateLimiter, (req, res) =>
  void adminProductController.update(req, res),
);
adminProductsRouter.delete("/:id", sensitiveWriteRateLimiter, (req, res) =>
  void adminProductController.remove(req, res),
);
