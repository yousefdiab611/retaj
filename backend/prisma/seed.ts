import { Prisma, PrismaClient, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";

import { syncProductTotalStock } from "../src/services/inventory/stockSync.service";

const prisma = new PrismaClient();

const SEED_PRODUCTS: {
  sku: string;
  barcode: string;
  name: string;
  category: string;
  price: string;
  stockQty: number;
}[] = [
  {
    sku: "CLO-001",
    barcode: "6290000001001",
    name: "Classic White Shirt",
    category: "Shirts",
    price: "129.00",
    stockQty: 120,
  },
  {
    sku: "CLO-002",
    barcode: "6290000001002",
    name: "Slim Fit Jeans",
    category: "Pants",
    price: "219.00",
    stockQty: 90,
  },
  {
    sku: "CLO-003",
    barcode: "6290000001003",
    name: "Leather Jacket",
    category: "Jackets",
    price: "479.00",
    stockQty: 35,
  },
  {
    sku: "CLO-004",
    barcode: "6290000001004",
    name: "Running Sneakers",
    category: "Shoes",
    price: "319.00",
    stockQty: 70,
  },
  {
    sku: "CLO-005",
    barcode: "6290000001005",
    name: "Silk Scarf",
    category: "Accessories",
    price: "89.00",
    stockQty: 150,
  },
  {
    sku: "CLO-006",
    barcode: "6290000001006",
    name: "Casual Polo",
    category: "Shirts",
    price: "149.00",
    stockQty: 110,
  },
  {
    sku: "CLO-007",
    barcode: "6290000001007",
    name: "Tailored Trousers",
    category: "Pants",
    price: "259.00",
    stockQty: 65,
  },
  {
    sku: "CLO-008",
    barcode: "6290000001008",
    name: "Lux Knit Sweater",
    category: "Jackets",
    price: "329.00",
    stockQty: 80,
  },
  {
    sku: "CLO-009",
    barcode: "6290000001009",
    name: "Classic Leather Belt",
    category: "Accessories",
    price: "89.00",
    stockQty: 140,
  },
  {
    sku: "CLO-010",
    barcode: "6290000001010",
    name: "Denim Jacket",
    category: "Jackets",
    price: "389.00",
    stockQty: 45,
  },
  {
    sku: "CLO-011",
    barcode: "6290000001011",
    name: "Ankle Boots",
    category: "Shoes",
    price: "345.00",
    stockQty: 60,
  },
  {
    sku: "CLO-012",
    barcode: "6290000001012",
    name: "Statement Tote Bag",
    category: "Accessories",
    price: "159.00",
    stockQty: 130,
  },
];

async function ensureDefaultWarehouse(branchId: string) {
  let wh = await prisma.warehouse.findFirst({
    where: { branchId, isDefault: true },
  });
  if (!wh) {
    wh = await prisma.warehouse.findFirst({
      where: { branchId },
      orderBy: { createdAt: "asc" },
    });
  }
  if (!wh) {
    wh = await prisma.warehouse.create({
      data: {
        branchId,
        name: "Main warehouse",
        isDefault: true,
        location: null,
      },
    });
  }
  return wh;
}

async function seedProductStock(productId: string, warehouseId: string, quantity: number) {
  await prisma.productStock.upsert({
    where: {
      productId_warehouseId: { productId, warehouseId },
    },
    create: {
      productId,
      warehouseId,
      quantity,
    },
    update: {
      quantity,
    },
  });
  await syncProductTotalStock(productId);
}

async function main() {
  let tenant = await prisma.tenant.findFirst({ where: { name: "Retaj Store Tenant" } });
  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: {
        name: "Retaj Store Tenant",
        domain: "retaj-store.local",
        plan: "ENTERPRISE",
      },
    });
  }

  let branch = await prisma.branch.findFirst({ where: { tenantId: tenant.id, name: "Main Store" } });
  if (!branch) {
    branch = await prisma.branch.create({
      data: {
        tenantId: tenant.id,
        name: "Main Store",
        address: "Demo address",
        phone: "+966500000000",
        warehouses: {
          create: {
            name: "Main warehouse",
            isDefault: true,
            location: null,
          },
        },
      },
    });
  }

  const warehouse = await ensureDefaultWarehouse(branch.id);

  await prisma.refreshToken.deleteMany();
  await prisma.stockMovement.deleteMany();
  await prisma.transactionLine.deleteMany();
  await prisma.transaction.deleteMany();

  const ahmedHash = await bcrypt.hash("ahmed123", 10);
  const emanHash = await bcrypt.hash("eman123", 10);
  const walidHash = await bcrypt.hash("walid123", 10);

  const existingUsers = await prisma.user.findMany({
    where: {
      username: { in: ["ahmed", "eman", "walid"] },
      tenantId: tenant.id,
    },
  });

  const existingUsernames = new Set(existingUsers.map((user) => user.username));

  if (!existingUsernames.has("ahmed")) {
    await prisma.user.create({
      data: {
        tenantId: tenant.id,
        username: "ahmed",
        email: "ahmed@retaj.local",
        name: "Ahmed Admin",
        passwordHash: ahmedHash,
        role: UserRole.ADMIN,
        branchId: null,
        isActive: true,
      },
    });
  } else {
    await prisma.user.updateMany({
      where: { tenantId: tenant.id, username: "ahmed" },
      data: { passwordHash: ahmedHash, isActive: true },
    });
  }

  if (!existingUsernames.has("eman")) {
    await prisma.user.create({
      data: {
        tenantId: tenant.id,
        username: "eman",
        email: "eman@retaj.local",
        name: "Eman Admin",
        passwordHash: emanHash,
        role: UserRole.ADMIN,
        branchId: null,
        isActive: true,
      },
    });
  } else {
    await prisma.user.updateMany({
      where: { tenantId: tenant.id, username: "eman" },
      data: { passwordHash: emanHash, role: UserRole.ADMIN, isActive: true },
    });
  }

  if (!existingUsernames.has("walid")) {
    await prisma.user.create({
      data: {
        tenantId: tenant.id,
        username: "walid",
        email: "walid@retaj.local",
        name: "Walid Cashier",
        passwordHash: walidHash,
        role: UserRole.CASHIER,
        branchId: branch.id,
        isActive: true,
      },
    });
  } else {
    await prisma.user.updateMany({
      where: { tenantId: tenant.id, username: "walid" },
      data: { passwordHash: walidHash, role: UserRole.CASHIER, branchId: branch.id, isActive: true },
    });
  }

  await prisma.license.upsert({
    where: { licenseKey: "RETAJ-DEMO-0000-0000" },
    create: {
      tenantId: tenant.id,
      licenseKey: "RETAJ-DEMO-0000-0000",
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      trialMode: true,
      graceDays: 7,
      status: "ACTIVE",
    },
    update: {
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      trialMode: true,
      graceDays: 7,
      status: "ACTIVE",
    },
  });

  for (const p of SEED_PRODUCTS) {
    const existing = await prisma.product.findFirst({
      where: { branchId: branch.id, sku: p.sku },
    });
    if (existing) {
      await prisma.product.update({
        where: { id: existing.id },
        data: {
          barcode: p.barcode,
          name: p.name,
          category: p.category,
          price: p.price,
          isActive: true,
        },
      });
      await seedProductStock(existing.id, warehouse.id, p.stockQty);
    } else {
      const created = await prisma.product.create({
        data: {
          branchId: branch.id,
          sku: p.sku,
          barcode: p.barcode,
          name: p.name,
          category: p.category,
          price: p.price,
          stockQty: 0,
          isActive: true,
        },
      });
      await seedProductStock(created.id, warehouse.id, p.stockQty);
    }
  }

  console.log(
    "Seed OK. Branch: Main Store. Login with username: ahmed / ahmed123. Admin: set X-Branch-Id header to branch id for POS.",
  );
  console.log("Branch id:", branch.id);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
