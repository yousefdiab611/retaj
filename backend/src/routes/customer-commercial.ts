import { Router } from "express";

import { requireAuth } from "../middleware/requireAuth";

const customerRouter = Router();

customerRouter.use(requireAuth);

const notImplemented = (
  _req: unknown,
  res: { status: (code: number) => { json: (body: unknown) => void } },
) => {
  res.status(501).json({ error: "Commercial customer endpoint not implemented", code: "NOT_IMPLEMENTED" });
};

// Customer self-service
customerRouter.get("/profile", notImplemented);

customerRouter.put("/profile", notImplemented);

customerRouter.get("/subscription", notImplemented);

customerRouter.post("/support", notImplemented);

export { customerRouter };
