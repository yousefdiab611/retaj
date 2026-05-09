import { Router } from "express";

import { licenseController } from "../controllers/licenseController";
import { requireRole } from "../middleware/requireRole";
import { UserRole } from "@prisma/client";

export const publicLicenseRouter = Router();
export const licenseRouter = Router();

publicLicenseRouter.post("/activate", (req, res) => void licenseController.activate(req, res));
publicLicenseRouter.post("/validate", (req, res) => void licenseController.validate(req, res));

licenseRouter.post(
  "/generate",
  requireRole(UserRole.SUPER_ADMIN, UserRole.ADMIN),
  (req, res) => void licenseController.generate(req, res),
);
