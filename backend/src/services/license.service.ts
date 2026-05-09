import crypto from "crypto";
import type { LicenseStatus, Prisma } from "@prisma/client";

import { AuditActions, type AuditAction } from "../constants/auditActions";
import { prisma } from "../lib/prisma";
import { writeAuditLog } from "./audit.service";

const DEFAULT_GRACE_DAYS = Math.max(0, Number(process.env.LICENSE_GRACE_DAYS ?? 7));

function formatLicenseKey(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .match(/.{1,4}/g)
    ?.join("-") ?? raw;
}

export function generateLicenseKey(): string {
  const raw = crypto.randomBytes(10).toString("hex").toUpperCase();
  return `RETAJ-${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}-${raw.slice(12, 16)}`;
}

export async function createLicenseRecord(options: {
  tenantId: string;
  expiresAt?: Date | null;
  trialMode?: boolean;
  graceDays?: number;
  deviceId?: string | null;
  deviceFingerprint?: string | null;
}): Promise<{ id: string; licenseKey: string; expiresAt: Date | null; trialMode: boolean; graceDays: number }> {
  const licenseKey = formatLicenseKey(generateLicenseKey());
  const license = await prisma.license.create({
    data: {
      tenantId: options.tenantId,
      licenseKey,
      deviceId: options.deviceId ?? null,
      deviceFingerprint: options.deviceFingerprint ?? null,
      expiresAt: options.expiresAt ?? null,
      trialMode: options.trialMode ?? false,
      graceDays: options.graceDays ?? DEFAULT_GRACE_DAYS,
      status: options.trialMode ? "ACTIVE" : "ACTIVE",
    },
  });
  await writeAuditLog({
    action: AuditActions.LICENSE_GENERATED,
    tenantId: options.tenantId,
    entityType: "License",
    entityId: license.id,
    metadata: {
      trialMode: options.trialMode ?? false,
      expiresAt: options.expiresAt?.toISOString() ?? null,
    },
  });
  return {
    id: license.id,
    licenseKey: license.licenseKey,
    expiresAt: license.expiresAt,
    trialMode: license.trialMode,
    graceDays: license.graceDays,
  };
}

export async function activateLicense(
  licenseKey: string,
  deviceId: string,
  deviceFingerprint: string,
  meta: { ip?: string; userAgent?: string },
): Promise<
  | {
      ok: true;
      status: LicenseStatus;
      expiresAt: Date | null;
      trialMode: boolean;
      graceRemainingDays: number;
      graceDays: number;
      graceUntil: string | null;
    }
  | { ok: false; reason: string }
> {
  const normalizedKey = formatLicenseKey(licenseKey);
  const license = await prisma.license.findUnique({ where: { licenseKey: normalizedKey } });
  if (!license) {
    await auditLicenseEvent(null, "LICENSE_ACTIVATION_FAILURE", { reason: "not_found", deviceId, deviceFingerprint, ...meta });
    return { ok: false, reason: "invalid_license" };
  }

  const now = new Date();
  const blockedDeviceMismatch = license.deviceId && license.deviceId !== deviceId;
  if (blockedDeviceMismatch) {
    await auditLicenseEvent(license, "LICENSE_ACTIVATION_FAILURE", { reason: "device_mismatch", deviceId, deviceFingerprint, ...meta });
    return { ok: false, reason: "device_mismatch" };
  }

  const expiresAt = license.expiresAt;
  const graceDays = license.graceDays ?? DEFAULT_GRACE_DAYS;
  const graceUntil = expiresAt ? new Date(expiresAt.getTime() + graceDays * 24 * 60 * 60 * 1000) : null;
  const isExpired = expiresAt ? expiresAt.getTime() < now.getTime() : false;
  const isGraceAllowed = graceUntil ? graceUntil.getTime() >= now.getTime() : !isExpired;

  if (license.status === "SUSPENDED") {
    await auditLicenseEvent(license, "LICENSE_ACTIVATION_FAILURE", { reason: "suspended", deviceId, deviceFingerprint, ...meta });
    return { ok: false, reason: "license_suspended" };
  }

  if (isExpired && !isGraceAllowed) {
    await auditLicenseEvent(license, "LICENSE_ACTIVATION_FAILURE", { reason: "expired", deviceId, deviceFingerprint, ...meta });
    return { ok: false, reason: "license_expired" };
  }

  const updated = await prisma.license.update({
    where: { id: license.id },
    data: {
      deviceId: license.deviceId ?? deviceId,
      deviceFingerprint: license.deviceFingerprint ?? deviceFingerprint,
      activationDate: license.activationDate ?? now,
      lastValidationAt: now,
      status: isExpired ? "EXPIRED" : "ACTIVE",
    },
  });

  await auditLicenseEvent(updated, "LICENSE_ACTIVATION_SUCCESS", { deviceId, deviceFingerprint, ...meta });
  return {
    ok: true,
    status: updated.status,
    expiresAt: updated.expiresAt,
    trialMode: updated.trialMode,
    graceRemainingDays: graceUntil ? Math.max(0, Math.ceil((graceUntil.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))) : 0,
    graceDays,
    graceUntil: graceUntil?.toISOString() ?? null,
  };
}

export async function validateLicense(
  licenseKey: string,
  deviceId: string,
  deviceFingerprint: string,
): Promise<
  | {
      ok: true;
      status: LicenseStatus;
      expiresAt: Date | null;
      trialMode: boolean;
      graceRemainingDays: number;
      graceDays: number;
      graceUntil: string | null;
    }
  | { ok: false; reason: string }
> {
  const normalizedKey = formatLicenseKey(licenseKey);
  const license = await prisma.license.findUnique({ where: { licenseKey: normalizedKey } });
  if (!license) {
    return { ok: false, reason: "invalid_license" };
  }
  if (license.deviceId && license.deviceId !== deviceId) {
    return { ok: false, reason: "device_mismatch" };
  }
  const now = new Date();
  const expiresAt = license.expiresAt;
  const graceDays = license.graceDays ?? DEFAULT_GRACE_DAYS;
  const graceUntil = expiresAt ? new Date(expiresAt.getTime() + graceDays * 24 * 60 * 60 * 1000) : null;
  const isExpired = expiresAt ? expiresAt.getTime() < now.getTime() : false;
  const isGraceAllowed = graceUntil ? graceUntil.getTime() >= now.getTime() : !isExpired;
  if (license.status === "SUSPENDED") {
    return { ok: false, reason: "license_suspended" };
  }
  if (isExpired && !isGraceAllowed) {
    return { ok: false, reason: "license_expired" };
  }
  await prisma.license.update({ where: { id: license.id }, data: { lastValidationAt: now } });
  return {
    ok: true,
    status: license.status,
    expiresAt: license.expiresAt,
    trialMode: license.trialMode,
    graceRemainingDays: graceUntil ? Math.max(0, Math.ceil((graceUntil.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))) : 0,
    graceDays,
    graceUntil: graceUntil?.toISOString() ?? null,
  };
}

export async function getLicenseByKey(licenseKey: string) {
  return prisma.license.findUnique({ where: { licenseKey: formatLicenseKey(licenseKey) } });
}

async function auditLicenseEvent(
  license: { id: string; tenantId: string } | null,
  action: AuditAction,
  metadata?: Record<string, unknown>,
): Promise<void> {
  await writeAuditLog({
    action,
    tenantId: license?.tenantId ?? null,
    entityType: "License",
    entityId: license?.id ?? null,
    metadata: (metadata ?? undefined) as unknown as Prisma.InputJsonValue,
  });
}
