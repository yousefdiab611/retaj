import { Router } from "express";
import { customerController } from "../controllers/customerController";
import { requireAuth } from "../middleware/requireAuth";

export const customerRouter = Router();

customerRouter.use(requireAuth);
customerRouter.get("/me", (req, res) => void customerController.getProfile(req, res));
customerRouter.get("/me/subscription", (req, res) => void customerController.getSubscription(req, res));
customerRouter.get("/me/licenses", (req, res) => void customerController.getLicenses(req, res));
customerRouter.get("/me/devices", (req, res) => void customerController.getDevices(req, res));
customerRouter.post("/me/devices/:id/revoke", (req, res) => void customerController.revokeDevice(req, res));
customerRouter.post("/me/support", (req, res) => void customerController.createSupportTicket(req, res));
