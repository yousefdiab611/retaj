import { UserRole } from "@prisma/client";
import { Router } from "express";

import { requireAuth } from "../middleware/requireAuth";
import { requireRole } from "../middleware/requireRole";

const adminRouter = Router();

adminRouter.use(requireAuth);
adminRouter.use(requireRole(UserRole.ADMIN, UserRole.TENANT_ADMIN));

const notImplemented = (
  _req: unknown,
  res: { status: (code: number) => { json: (body: unknown) => void } },
) => {
  res.status(501).json({ error: "Commercial admin endpoint not implemented", code: "NOT_IMPLEMENTED" });
};

// Dashboard stats
adminRouter.get("/stats", notImplemented);

// Customer management
adminRouter.get("/customers", notImplemented);

adminRouter.post("/customers", notImplemented);

adminRouter.put("/customers/:id", notImplemented);

// Subscription management
adminRouter.get("/subscriptions", notImplemented);

// License management
adminRouter.post("/licenses", notImplemented);

adminRouter.post("/licenses/:id/revoke", notImplemented);

// Monitoring
adminRouter.get("/alerts", notImplemented);

adminRouter.get("/backups", notImplemented);

// Support
adminRouter.get("/tickets", notImplemented);

adminRouter.post("/tickets", notImplemented);

export { adminRouter };
