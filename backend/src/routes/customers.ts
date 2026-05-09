import { Router } from "express";

import { prisma } from "../lib/prisma";

export const customersRouter = Router();

function normalizeQuery(value: string): string {
  return value.trim();
}

function normalizePhone(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized === "" ? null : normalized;
}

customersRouter.get("/", async (req, res) => {
  const tenantId = req.userTenantId;
  if (!tenantId) {
    res.status(403).json({ error: "Tenant context required", code: "TENANT_REQUIRED" });
    return;
  }
  const q = normalizeQuery(typeof req.query.q === "string" ? req.query.q : "");
  const where = {
    tenantId,
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" as const } },
            { city: { contains: q, mode: "insensitive" as const } },
            { ownerName: { contains: q, mode: "insensitive" as const } },
            { email: { contains: q, mode: "insensitive" as const } },
            { phone: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };
  const customers = await prisma.customer.findMany({
    where,
    take: 50,
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      city: true,
      ownerName: true,
      email: true,
      phone: true,
      paymentBalance: true,
      loyaltyPoints: true,
      notes: true,
      isSuspended: true,
    },
  });
  res.json({ customers });
});

customersRouter.get("/:id/ledger", async (req, res) => {
  const tenantId = req.userTenantId;
  if (!tenantId) {
    res.status(403).json({ error: "Tenant context required", code: "TENANT_REQUIRED" });
    return;
  }
  const id = typeof req.params.id === "string" ? req.params.id.trim() : "";
  if (!id) {
    res.status(400).json({ error: "Customer id is required", code: "VALIDATION" });
    return;
  }
  const customer = await prisma.customer.findFirst({
    where: { id, tenantId },
    select: {
      id: true,
      name: true,
      paymentBalance: true,
      creditLedger: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          type: true,
          amount: true,
          balanceAfter: true,
          note: true,
          createdAt: true,
        },
      },
    },
  });
  if (!customer) {
    res.status(404).json({ error: "Customer not found", code: "NOT_FOUND" });
    return;
  }
  res.json({ customer });
});

customersRouter.post("/", async (req, res) => {
  const tenantId = req.userTenantId;
  if (!tenantId) {
    res.status(403).json({ error: "Tenant context required", code: "TENANT_REQUIRED" });
    return;
  }
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  if (!name) {
    res.status(400).json({ error: "name is required" });
    return;
  }
  const city = typeof req.body?.city === "string" ? req.body.city.trim() || null : null;
  const ownerName = typeof req.body?.ownerName === "string" ? req.body.ownerName.trim() || null : null;
  const email = typeof req.body?.email === "string" ? req.body.email.trim() || null : null;
  const phone = normalizePhone(req.body?.phone);
  const notes = typeof req.body?.notes === "string" ? req.body.notes.trim() || null : null;
  const loyaltyPoints = typeof req.body?.loyaltyPoints === "number" ? Math.max(0, Math.floor(req.body.loyaltyPoints)) : undefined;

  let customer = null;
  if (phone) {
    customer = await prisma.customer.findFirst({ where: { tenantId, phone } });
  }
  if (!customer && email) {
    customer = await prisma.customer.findFirst({ where: { tenantId, email } });
  }

  if (customer) {
    customer = await prisma.customer.update({
      where: { id: customer.id },
      data: {
        name,
        city,
        ownerName,
        email,
        phone,
        notes,
      },
      select: {
        id: true,
        name: true,
        city: true,
        ownerName: true,
        email: true,
        phone: true,
        paymentBalance: true,
        notes: true,
        isSuspended: true,
      },
    });
  } else {
    customer = await prisma.customer.create({
      data: { tenantId, name, city, ownerName, email, phone, notes, loyaltyPoints },
      select: {
        id: true,
        name: true,
        city: true,
        ownerName: true,
        email: true,
        phone: true,
        paymentBalance: true,
        loyaltyPoints: true,
        notes: true,
        isSuspended: true,
      },
    });
  }

  res.status(201).json({ customer });
});

customersRouter.patch("/:id", async (req, res) => {
  const tenantId = req.userTenantId;
  if (!tenantId) {
    res.status(403).json({ error: "Tenant context required", code: "TENANT_REQUIRED" });
    return;
  }
  const id = typeof req.params.id === "string" ? req.params.id.trim() : "";
  if (!id) {
    res.status(400).json({ error: "Customer id is required", code: "VALIDATION" });
    return;
  }

  const name = typeof req.body?.name === "string" ? req.body.name.trim() : undefined;
  const city = typeof req.body?.city === "string" ? req.body.city.trim() || null : undefined;
  const ownerName = typeof req.body?.ownerName === "string" ? req.body.ownerName.trim() || null : undefined;
  const email = typeof req.body?.email === "string" ? req.body.email.trim() || null : undefined;
  const phone = req.body?.phone === undefined ? undefined : normalizePhone(req.body?.phone);
  const notes = typeof req.body?.notes === "string" ? req.body.notes.trim() || null : undefined;
  const loyaltyPoints = typeof req.body?.loyaltyPoints === "number" ? Math.max(0, Math.floor(req.body.loyaltyPoints)) : undefined;

  const updateData: Record<string, unknown> = {};
  if (name !== undefined) updateData.name = name;
  if (city !== undefined) updateData.city = city;
  if (ownerName !== undefined) updateData.ownerName = ownerName;
  if (email !== undefined) updateData.email = email;
  if (phone !== undefined) updateData.phone = phone;
  if (notes !== undefined) updateData.notes = notes;
  if (loyaltyPoints !== undefined) updateData.loyaltyPoints = loyaltyPoints;

  if (Object.keys(updateData).length === 0) {
    res.status(400).json({ error: "No update data provided", code: "VALIDATION" });
    return;
  }

  const customer = await prisma.customer.updateMany({
    where: { id, tenantId },
    data: updateData,
  });
  if (customer.count === 0) {
    res.status(404).json({ error: "Customer not found", code: "NOT_FOUND" });
    return;
  }

  const updated = await prisma.customer.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      city: true,
      ownerName: true,
      email: true,
      phone: true,
      paymentBalance: true,
      loyaltyPoints: true,
      notes: true,
      isSuspended: true,
    },
  });

  res.json({ customer: updated });
});
