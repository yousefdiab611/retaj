import { Router } from "express";

import { getDatabaseStatus, isDatabaseOnline } from "../lib/dbBootstrap";

const healthRouter = Router();

healthRouter.get("/uptime", (_req, res) => {
  res.json({ uptime: process.uptime(), status: "OK" });
});

healthRouter.get("/db", (_req, res) => {
  const dbStatus = getDatabaseStatus();
  if (isDatabaseOnline()) {
    res.json({ db: "connected", status: dbStatus });
    return;
  }
  res.status(503).json({ db: "unavailable", status: dbStatus });
});

export { healthRouter };