import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { requireRole } from "../middleware/requireRole";
import { UserRole } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { BackupService } from "../services/backup.service";

const backupRouter = Router();

backupRouter.use(requireAuth);
backupRouter.use(requireRole(UserRole.ADMIN, UserRole.TENANT_ADMIN));

backupRouter.post("/create", async (req, res) => {
  const tenantId = req.userTenantId;
  if (!tenantId) {
    res.status(400).json({ error: "Tenant context missing", code: "TENANT_REQUIRED" });
    return;
  }

  const type = req.body?.type === "scheduled" ? "scheduled" : "manual";
  const backupService = new BackupService();
  try {
    const result = await backupService.createBackup(tenantId, type);
    res.status(201).json({ backup: result });
  } catch (error) {
    res.status(500).json({ error: "Failed to create backup", code: "BACKUP_FAILED" });
  }
});

backupRouter.get("/list", async (req, res) => {
  const tenantId = req.userTenantId;
  if (!tenantId) {
    res.status(400).json({ error: "Tenant context missing", code: "TENANT_REQUIRED" });
    return;
  }

  const backups = await prisma.backup.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  res.json({ backups });
});

export { backupRouter };