import { Prisma } from "@prisma/client";
import { Router } from "express";

import { AuditActions } from "../constants/auditActions";
import { writeAuditLog } from "../services/audit.service";
import { listUsersForAdmin, updateUserByAdmin } from "../services/userAdmin.service";
import { getClientIp, getUserAgent, firstPathParam } from "../utils/requestMeta";
import { patchUserBodySchema } from "../validation/schemas";
import { logger } from "../lib/logger";

export const usersRouter = Router();

usersRouter.get("/", async (req, res) => {
  const tenantId = req.userTenantId;
  if (!tenantId) {
    res.status(403).json({ error: "Tenant context required", code: "TENANT_REQUIRED" });
    return;
  }
  const users = await listUsersForAdmin(tenantId);
  res.json({ users });
});

usersRouter.patch("/:id", async (req, res) => {
  const tenantId = req.userTenantId;
  if (!tenantId) {
    res.status(403).json({ error: "Tenant context required", code: "TENANT_REQUIRED" });
    return;
  }
  const parsed = patchUserBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten().fieldErrors, code: "VALIDATION" });
    return;
  }
  const id = firstPathParam(req.params.id);
  const actorId = req.userId;
  try {
    const user = await updateUserByAdmin(tenantId, id, parsed.data);
    if (actorId) {
      await writeAuditLog({
        action: AuditActions.USER_UPDATE,
        userId: actorId,
        entityType: "User",
        entityId: id,
        tenantId,
        ip: getClientIp(req),
        userAgent: getUserAgent(req),
        metadata: { targetUserId: id, fields: Object.keys(parsed.data) },
      });
    }
    res.json({ user });
  } catch (e) {
    if (
      (e as Error & { code?: string }).code === "P2025" ||
      (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025")
    ) {
      res.status(404).json({ error: "User not found", code: "NOT_FOUND" });
      return;
    }
    logger.error({ err: e }, "updateUser");
    throw e;
  }
});
