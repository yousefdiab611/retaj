import { Router } from "express";
import { UserRole } from "@prisma/client";

import { adminController } from "../controllers/adminController";
import { requireRole } from "../middleware/requireRole";

export const adminRouter = Router();

adminRouter.use(requireRole(UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN, UserRole.ADMIN));

adminRouter.get("/dashboard", (req, res) => void adminController.dashboardStats(req, res));
adminRouter.get("/licenses", (req, res) => void adminController.listLicenses(req, res));
adminRouter.post("/licenses", (req, res) => void adminController.createLicense(req, res));
adminRouter.post("/licenses/:id/revoke", (req, res) => void adminController.revokeLicense(req, res));
adminRouter.patch("/licenses/:id/extend", (req, res) => void adminController.extendLicense(req, res));
adminRouter.patch("/licenses/:id/bind", (req, res) => void adminController.bindLicense(req, res));
adminRouter.patch("/licenses/:id/unbind", (req, res) => void adminController.unbindLicense(req, res));
adminRouter.get("/customers", (req, res) => void adminController.listCustomers(req, res));
adminRouter.get("/customers/:id", (req, res) => void adminController.getCustomer(req, res));
adminRouter.get("/logs", (req, res) => void adminController.listAuditLogs(req, res));
adminRouter.get("/subscriptions", (req, res) => void adminController.listSubscriptions(req, res));
adminRouter.get("/payments", (req, res) => void adminController.listPayments(req, res));
