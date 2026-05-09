import { prisma } from "../lib/prisma";

import type { UserRole } from "@prisma/client";

export async function listUsersForAdmin(tenantId: string) {
  return prisma.user.findMany({
    where: { tenantId },
    orderBy: { name: "asc" },
    select: {
      id: true,
      username: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      branchId: true,
      createdAt: true,
    },
  });
}

export async function updateUserByAdmin(
  tenantId: string,
  userId: string,
  data: {
    name?: string;
    role?: UserRole;
    isActive?: boolean;
    branchId?: string | null;
  },
) {
  const user = await prisma.user.findFirst({ where: { id: userId, tenantId } });
  if (!user) {
    const err = new Error("User not found") as Error & { code?: string };
    err.code = "P2025";
    throw err;
  }

  return prisma.user.update({
    where: { id: userId },
    data: {
      ...(data.name !== undefined ? { name: data.name.trim() } : {}),
      ...(data.role !== undefined ? { role: data.role } : {}),
      ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      ...(data.branchId !== undefined ? { branchId: data.branchId } : {}),
    },
    select: {
      id: true,
      username: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      branchId: true,
    },
  });
}
