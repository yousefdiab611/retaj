import bcrypt from "bcryptjs";
import { UserRole } from "@prisma/client";

import { AuditActions } from "../constants/auditActions";
import { signAccessToken } from "../lib/jwt";
import { prisma } from "../lib/prisma";
import { generateOpaqueToken, hashOpaqueToken } from "../lib/tokenCrypto";
import { writeAuditLog } from "./audit.service";
import { reportLoginFailure, reportLoginSuccess } from "../lib/loginBlocker";
import { logger } from "../lib/logger";

function refreshExpiresAt(): Date {
  const days = Number(process.env.JWT_REFRESH_DAYS ?? "14");
  const d = Math.min(Math.max(Number.isFinite(days) ? days : 14, 1), 365);
  const t = Date.now() + d * 24 * 60 * 60 * 1000;
  return new Date(t);
}

export type BranchBrief = {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
};

export type AuthUserBrief = {
  id: string;
  username: string | null;
  email: string | null;
  name: string;
  role: string;
  tenantId: string;
  branchId: string | null;
  branches: BranchBrief[];
  tenantPlan: string;
  tenantBillingStatus: string;
  tenantPlanExpiresAt: string | null;
  tenantRestricted: boolean;
};

function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

export async function loginWithPassword(
  usernameRaw: string,
  password: string,
  meta: { ip?: string; userAgent?: string },
): Promise<
  | { ok: true; accessToken: string; refreshToken: string; user: AuthUserBrief }
  | { ok: false; reason: "invalid_credentials" }
> {
  const uname = normalizeUsername(usernameRaw);
  let user;
  try {
    user = await prisma.user.findFirst({
      where: {
        username: uname,
        isActive: true,
      },
      include: { tenant: true },
    });
  } catch (err) {
    logger.error({ err, username: uname }, "user_lookup_failed");
    throw err;
  }

  if (!user || !user.tenant?.isActive) {
    reportLoginFailure(meta.ip);
    await writeAuditLog({
      action: AuditActions.LOGIN_FAILURE,
      metadata: { reason: "invalid_account" },
      userId: user?.id ?? null,
      tenantId: user?.tenantId ?? undefined,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    return { ok: false, reason: "invalid_credentials" };
  }

  logger.debug({ userId: user.id, tenantId: user.tenantId }, "login_user_lookup_success");

  const passwordHash = user.passwordHash;
  if (typeof passwordHash !== "string" || passwordHash.length === 0) {
    logger.warn({ userId: user.id, tenantId: user.tenantId }, "user_missing_password_hash");
    reportLoginFailure(meta.ip);
    await writeAuditLog({
      action: AuditActions.LOGIN_FAILURE,
      userId: user.id,
      tenantId: user.tenantId,
      metadata: { reason: "missing_password_hash" },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    return { ok: false, reason: "invalid_credentials" };
  }

  let match = false;
  const isBcryptHash = /^\$2[aby]?\$/.test(passwordHash);
  if (!isBcryptHash) {
    logger.warn({ userId: user.id, tenantId: user.tenantId }, "user_password_hash_not_bcrypt");
    if (password === passwordHash) {
      try {
        const hashed = await bcrypt.hash(password, 10);
        await prisma.user.update({ where: { id: user.id }, data: { passwordHash: hashed } });
        match = true;
      } catch (err) {
        logger.error({ err, userId: user.id }, "bcrypt_rehash_failed");
        match = false;
      }
    }
  } else {
    try {
      match = await bcrypt.compare(password, passwordHash);
    } catch (err) {
      logger.warn({ err, userId: user.id, tenantId: user.tenantId }, "bcrypt_compare_error");
      match = false;
    }
  }

  logger.debug({ userId: user.id, tenantId: user.tenantId, match }, "login_password_check");

  if (!match) {
    reportLoginFailure(meta.ip);
    await writeAuditLog({
      action: AuditActions.LOGIN_FAILURE,
      userId: user.id,
      tenantId: user.tenantId,
      metadata: { reason: "bad_password" },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    return { ok: false, reason: "invalid_credentials" };
  }

  const rawRefresh = generateOpaqueToken();
  const tokenHash = hashOpaqueToken(rawRefresh);
  const expiresAt = refreshExpiresAt();

  try {
    await prisma.refreshToken.create({
      data: { tokenHash, userId: user.id, expiresAt },
    });
  } catch (err) {
    logger.error({ err, userId: user.id, tenantId: user.tenantId }, "refresh_token_create_failed");
    throw err;
  }

  let accessToken: string;
  try {
    accessToken = signAccessToken(user.id);
  } catch (err) {
    logger.error({ err, userId: user.id, tenantId: user.tenantId }, "access_token_sign_failed");
    throw err;
  }

  reportLoginSuccess(meta.ip);

  await writeAuditLog({
    action: AuditActions.LOGIN_SUCCESS,
    userId: user.id,
    tenantId: user.tenantId,
    entityType: "User",
    entityId: user.id,
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  const allBranches = await prisma.branch.findMany({
    where: { tenantId: user.tenantId },
    orderBy: { name: "asc" },
    select: { id: true, name: true, address: true, phone: true },
  });

  let branches: BranchBrief[] = allBranches.map((b) => ({
    id: b.id,
    name: b.name,
    address: b.address,
    phone: b.phone,
  }));

  if (user.role === UserRole.CASHIER && user.branchId) {
    branches = branches.filter((b) => b.id === user.branchId);
  }

  return {
    ok: true,
    accessToken,
    refreshToken: rawRefresh,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      name: user.name,
      role: user.role,
      tenantId: user.tenantId,
      branchId: user.branchId,
      branches,
      tenantPlan: user.tenant.plan,
      tenantBillingStatus: user.tenant.billingStatus,
      tenantPlanExpiresAt: user.tenant.planExpiresAt?.toISOString() ?? null,
      tenantRestricted:
        user.tenant.billingStatus !== "ACTIVE" ||
        (!!user.tenant.planExpiresAt && user.tenant.planExpiresAt.getTime() < Date.now()),
    },
  };
}

export async function refreshSession(
  refreshToken: string,
  meta: { ip?: string; userAgent?: string },
): Promise<
  | { ok: true; accessToken: string; refreshToken: string }
  | { ok: false; reason: "invalid" | "expired" | "revoked" }
> {
  const tokenHash = hashOpaqueToken(refreshToken);
  const row = await prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: { user: { include: { tenant: true } } },
  });

  if (!row) {
    return { ok: false, reason: "invalid" };
  }
  if (row.revokedAt) {
    return { ok: false, reason: "revoked" };
  }
  if (row.expiresAt.getTime() < Date.now()) {
    return { ok: false, reason: "expired" };
  }
  if (!row.user.isActive || !row.user.tenant?.isActive) {
    return { ok: false, reason: "revoked" };
  }

  const newRaw = generateOpaqueToken();
  const newHash = hashOpaqueToken(newRaw);
  const expiresAt = refreshExpiresAt();

  await prisma.$transaction([
    prisma.refreshToken.update({
      where: { id: row.id },
      data: { revokedAt: new Date() },
    }),
    prisma.refreshToken.create({
      data: { tokenHash: newHash, userId: row.userId, expiresAt },
    }),
  ]);

  const accessToken = signAccessToken(row.userId);

  await writeAuditLog({
    action: AuditActions.TOKEN_REFRESH,
    userId: row.userId,
    entityType: "RefreshToken",
    entityId: row.id,
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  return { ok: true, accessToken, refreshToken: newRaw };
}

export async function logoutRefreshToken(
  refreshToken: string,
  meta: { userId?: string; ip?: string; userAgent?: string },
): Promise<void> {
  const tokenHash = hashOpaqueToken(refreshToken);
  const row = await prisma.refreshToken.findUnique({ where: { tokenHash } });
  if (!row || row.revokedAt) {
    return;
  }
  await prisma.refreshToken.update({
    where: { id: row.id },
    data: { revokedAt: new Date() },
  });
  await writeAuditLog({
    action: AuditActions.LOGOUT,
    userId: meta.userId ?? row.userId,
    entityType: "RefreshToken",
    entityId: row.id,
    ip: meta.ip,
    userAgent: meta.userAgent,
  });
}

