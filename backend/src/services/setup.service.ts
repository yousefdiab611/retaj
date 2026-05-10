import { UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";

import { prisma } from "../lib/prisma";

export type InitialSetupInput = {
  businessName: string;
  branchName: string;
  adminName: string;
  adminUsername: string;
  adminPassword: string;
  adminEmail?: string;
  storePhone?: string;
  storeAddress?: string;
};

export type InitialSetupResult =
  | {
      ok: true;
      tenantId: string;
      branchId: string;
      userId: string;
    }
  | {
      ok: false;
      code: "ALREADY_INITIALIZED" | "USERNAME_TAKEN";
    };

/** True iff no users exist yet — i.e. the install is freshly provisioned. */
export async function isFreshInstall(): Promise<boolean> {
  const userCount = await prisma.user.count();
  return userCount === 0;
}

/**
 * Creates the very first tenant + branch + super-admin user. Refuses to run
 * if any user already exists, so this endpoint can be safely left exposed
 * — it self-locks after the first successful invocation.
 */
export async function performInitialSetup(input: InitialSetupInput): Promise<InitialSetupResult> {
  const fresh = await isFreshInstall();
  if (!fresh) {
    return { ok: false, code: "ALREADY_INITIALIZED" };
  }

  const existing = await prisma.user.findUnique({ where: { username: input.adminUsername } });
  if (existing) {
    return { ok: false, code: "USERNAME_TAKEN" };
  }

  const passwordHash = await bcrypt.hash(input.adminPassword, 10);

  const result = await prisma.$transaction(async (tx) => {
    // Re-check inside the transaction so two parallel requests cannot
    // race to create two tenants on a fresh database.
    const racingCount = await tx.user.count();
    if (racingCount > 0) {
      throw new Error("ALREADY_INITIALIZED_RACE");
    }
    const tenant = await tx.tenant.create({
      data: {
        name: input.businessName,
        storePhone: input.storePhone || null,
        storeAddress: input.storeAddress || null,
        isActive: true,
      },
    });
    const branch = await tx.branch.create({
      data: {
        tenantId: tenant.id,
        name: input.branchName,
      },
    });
    const user = await tx.user.create({
      data: {
        tenantId: tenant.id,
        username: input.adminUsername,
        email: input.adminEmail || null,
        name: input.adminName,
        passwordHash,
        role: UserRole.SUPER_ADMIN,
        isActive: true,
      },
    });
    return { tenantId: tenant.id, branchId: branch.id, userId: user.id };
  });

  return { ok: true, ...result };
}
