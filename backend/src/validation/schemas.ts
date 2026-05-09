import { BillingStatus, SubscriptionPlan, UserRole } from "@prisma/client";
import { z } from "zod";

export const loginBodySchema = z.object({
  username: z.string().trim().min(1).max(64).regex(/^[a-zA-Z0-9._-]+$/, "Invalid username"),
  password: z.string().min(1).max(500),
});

export const createSaleBodySchema = z.object({
  customerId: z.string().cuid().nullable().optional(),
  warehouseId: z.string().cuid().optional(),
  discount: z.coerce.number().nonnegative().optional(),
  paymentMethod: z.enum(["cash", "card", "wallet", "split", "account"]),
  paidAmount: z.coerce.number().nonnegative().optional(),
  lineItems: z
    .array(
      z.object({
        productId: z.string().cuid(),
        productVariantId: z.string().cuid().nullable().optional(),
        quantity: z.coerce.number().int().positive(),
      }),
    )
    .min(1),
  /** Set by POS clients for safe retries and offline sync deduplication. */
  idempotencyKey: z.string().uuid().optional(),
});

/** One queued offline sale (idempotency key + same body as create sale). */
export const offlineSyncItemSchema = createSaleBodySchema.extend({
  idempotencyKey: z.string().uuid(),
});

export const offlineSyncBodySchema = z.object({
  items: z.array(offlineSyncItemSchema).min(1).max(100),
});

export const patchUserBodySchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    role: z.nativeEnum(UserRole).optional(),
    isActive: z.boolean().optional(),
    branchId: z.string().cuid().nullable().optional(),
  })
  .refine((o) => Object.keys(o).length > 0, { message: "At least one field required" });

export const branchCreateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  address: z.string().trim().max(500).nullable().optional(),
  phone: z.string().trim().max(50).nullable().optional(),
});

export const branchPatchSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    address: z.string().trim().max(500).nullable().optional(),
    phone: z.string().trim().max(50).nullable().optional(),
  })
  .refine((o) => Object.keys(o).length > 0, { message: "At least one field required" });

export const tenantCreateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  domain: z.string().trim().max(200).nullable().optional(),
  plan: z.nativeEnum(SubscriptionPlan).optional(),
});

export const tenantPatchSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    domain: z.string().trim().max(200).nullable().optional(),
    plan: z.nativeEnum(SubscriptionPlan).optional(),
    billingStatus: z.nativeEnum(BillingStatus).optional(),
    planExpiresAt: z.string().datetime().nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .refine((o) => Object.keys(o).length > 0, { message: "At least one field required" });

export const refreshTokenBodySchema = z.object({
  refreshToken: z.string().min(10).max(2048),
});

export const licenseActivateSchema = z.object({
  licenseKey: z.string().trim().min(10).max(128),
  deviceId: z.string().trim().min(1).max(128),
  deviceFingerprint: z.string().trim().min(1).max(256),
});

export const licenseValidateSchema = z.object({
  licenseKey: z.string().trim().min(10).max(128),
  deviceId: z.string().trim().min(1).max(128),
  deviceFingerprint: z.string().trim().min(1).max(256),
});

export const licenseGenerateSchema = z.object({
  expiresInDays: z.number().int().positive().optional(),
  trialMode: z.boolean().optional(),
  graceDays: z.number().int().nonnegative().optional(),
  tenantId: z.string().cuid().optional(),
});

const nullableTrimmed = z.union([z.string().trim().max(5000), z.literal(""), z.null()]);

export const adminProductCreateSchema = z.object({
  sku: z.string().trim().min(1).max(120),
  name: z.string().trim().min(1).max(500),
  barcode: z.union([z.string().trim().max(120), z.literal(""), z.null()]).optional(),
  category: nullableTrimmed.optional(),
  description: nullableTrimmed.optional(),
  price: z.coerce.number().nonnegative(),
  cost: z.coerce.number().nonnegative().nullable().optional(),
  stockQty: z.coerce.number().int().nonnegative(),
  lowStockAt: z.coerce.number().int().nonnegative().nullable().optional(),
  reorderLevel: z.coerce.number().int().nonnegative().nullable().optional(),
  isActive: z.boolean().optional(),
});

export const warehouseCreateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  location: z.string().trim().max(500).nullable().optional(),
  isDefault: z.boolean().optional(),
});

export const stockInBodySchema = z.object({
  productId: z.string().cuid(),
  warehouseId: z.string().cuid(),
  quantity: z.coerce.number().int().positive(),
  note: z.string().trim().max(2000).nullable().optional(),
  reference: z.string().trim().max(200).nullable().optional(),
});

export const stockOutBodySchema = z.object({
  productId: z.string().cuid(),
  warehouseId: z.string().cuid(),
  quantity: z.coerce.number().int().positive(),
  note: z.string().trim().max(2000).nullable().optional(),
  reference: z.string().trim().max(200).nullable().optional(),
});

export const stockTransferBodySchema = z.object({
  productId: z.string().cuid(),
  fromWarehouseId: z.string().cuid(),
  toWarehouseId: z.string().cuid(),
  quantity: z.coerce.number().int().positive(),
  note: z.string().trim().max(2000).nullable().optional(),
});

export const adminProductPatchSchema = z
  .object({
    sku: z.string().trim().min(1).max(120).optional(),
    name: z.string().trim().min(1).max(500).optional(),
    barcode: z.union([z.string().trim().max(120), z.literal(""), z.null()]).optional(),
    category: nullableTrimmed.optional(),
    description: nullableTrimmed.optional(),
    price: z.coerce.number().nonnegative().optional(),
    cost: z.coerce.number().nonnegative().nullable().optional(),
    stockQty: z.coerce.number().int().nonnegative().optional(),
    lowStockAt: z.coerce.number().int().nonnegative().nullable().optional(),
    reorderLevel: z.coerce.number().int().nonnegative().nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .refine((o) => Object.keys(o).length > 0, { message: "At least one field required" });
