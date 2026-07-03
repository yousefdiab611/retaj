import { UserRole } from "@prisma/client";
import { Router } from "express";

import { requireAuth } from "../middleware/requireAuth";
import { requireRole } from "../middleware/requireRole";

const billingRouter = Router();

billingRouter.use(requireAuth);

const notImplemented = (
  _req: unknown,
  res: { status: (code: number) => { json: (body: unknown) => void } },
) => {
  res.status(501).json({ error: "Commercial billing endpoint not implemented", code: "NOT_IMPLEMENTED" });
};

// Invoice generation
billingRouter.post("/invoices", requireRole(UserRole.ADMIN), notImplemented);

// Payment recording
billingRouter.post("/payments", notImplemented);

// Subscription management
billingRouter.post("/subscriptions", requireRole(UserRole.ADMIN), notImplemented);

billingRouter.put("/subscriptions/:id", requireRole(UserRole.ADMIN), notImplemented);

export { billingRouter };
