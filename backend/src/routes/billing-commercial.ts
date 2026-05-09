import { UserRole } from "@prisma/client";
import { Router } from "express";

import { requireAuth } from "../middleware/requireAuth";
import { requireRole } from "../middleware/requireRole";

const billingRouter = Router();

billingRouter.use(requireAuth);

// Invoice generation
billingRouter.post("/invoices", requireRole(UserRole.ADMIN), async (req, res) => {
  // Generate invoice
});

// Payment recording
billingRouter.post("/payments", async (req, res) => {
  // Record payment
});

// Subscription management
billingRouter.post("/subscriptions", requireRole(UserRole.ADMIN), async (req, res) => {
  // Create subscription
});

billingRouter.put("/subscriptions/:id", requireRole(UserRole.ADMIN), async (req, res) => {
  // Update subscription
});

export { billingRouter };
