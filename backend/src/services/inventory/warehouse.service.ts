import type { Prisma } from "@prisma/client";

import { prisma } from "../../lib/prisma";

export type WarehouseDto = {
  id: string;
  name: string;
  location: string | null;
  branchId: string | null;
  isDefault: boolean;
  createdAt: string;
};

function map(w: {
  id: string;
  name: string;
  location: string | null;
  branchId: string | null;
  isDefault: boolean;
  createdAt: Date;
}): WarehouseDto {
  return {
    id: w.id,
    name: w.name,
    location: w.location,
    branchId: w.branchId,
    isDefault: w.isDefault,
    createdAt: w.createdAt.toISOString(),
  };
}

export async function listWarehousesForBranch(branchId: string): Promise<WarehouseDto[]> {
  const rows = await prisma.warehouse.findMany({
    where: { branchId },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
  });
  return rows.map(map);
}

export async function createWarehouseForBranch(
  branchId: string,
  data: { name: string; location?: string | null; isDefault?: boolean },
): Promise<WarehouseDto> {
  const isDefault = data.isDefault === true;
  if (isDefault) {
    await prisma.warehouse.updateMany({
      where: { branchId, isDefault: true },
      data: { isDefault: false },
    });
  }
  const row = await prisma.warehouse.create({
    data: {
      name: data.name.trim(),
      location: data.location?.trim() || null,
      branchId,
      isDefault,
    },
  });
  return map(row);
}

/** Returns default warehouse for branch, or null if none. */
export async function getDefaultWarehouseForBranch(branchId: string) {
  let w = await prisma.warehouse.findFirst({
    where: { branchId, isDefault: true },
  });
  if (!w) {
    w = await prisma.warehouse.findFirst({
      where: { branchId },
      orderBy: { createdAt: "asc" },
    });
  }
  return w;
}

export async function getOrCreateDefaultWarehouse(
  branchId: string,
  tx?: Prisma.TransactionClient,
): Promise<{ id: string }> {
  const db = tx ?? prisma;
  let w = await db.warehouse.findFirst({
    where: { branchId, isDefault: true },
  });
  if (!w) {
    w = await db.warehouse.findFirst({
      where: { branchId },
      orderBy: { createdAt: "asc" },
    });
  }
  if (w) return w;
  const created = await db.warehouse.create({
    data: {
      name: "Main warehouse",
      branchId,
      isDefault: true,
      location: null,
    },
  });
  return created;
}

export async function resolveWarehouseIdForSale(
  branchId: string,
  requestedWarehouseId: string | undefined,
): Promise<string> {
  if (requestedWarehouseId) {
    const w = await prisma.warehouse.findFirst({
      where: { id: requestedWarehouseId, branchId },
    });
    if (!w) {
      throw new Error("INVALID_WAREHOUSE");
    }
    return w.id;
  }
  const def = await getDefaultWarehouseForBranch(branchId);
  if (!def) {
    throw new Error("NO_WAREHOUSE");
  }
  return def.id;
}
