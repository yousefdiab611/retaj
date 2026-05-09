import { Router } from "express";
import { billingController } from "../controllers/billingController";
import { requireAuth } from "../middleware/requireAuth";

export const billingRouter = Router();

billingRouter.get("/plans", (req, res) => void billingController.getPlans(req, res));
billingRouter.post("/checkout", requireAuth, (req, res) => void billingController.createCheckoutSession(req, res));
billingRouter.get("/subscriptions", requireAuth, (req, res) => void billingController.listSubscriptions(req, res));
billingRouter.post("/subscriptions/:id/cancel", requireAuth, (req, res) => void billingController.cancelSubscription(req, res));

billingRouter.post("/webhook/stripe", (req, res) => void billingController.handleStripeWebhook(req, res));
