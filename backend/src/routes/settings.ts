import { Router } from "express";

import { prisma } from "../lib/prisma";

export const settingsRouter = Router();

settingsRouter.get("/", async (req, res) => {
  const tenantId = req.userTenantId;
  const tenant = tenantId
    ? await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: {
          name: true,
          storePhone: true,
          storeAddress: true,
          storeLogoUrl: true,
          receiptFooter: true,
          returnPolicy: true,
        },
      })
    : null;

  res.json({
    storeName: tenant?.name ?? process.env.STORE_NAME ?? "RETAJ STORE",
    currency: process.env.STORE_CURRENCY ?? "SAR",
    taxLabel: process.env.STORE_TAX_LABEL ?? "VAT (15%)",
    thankYou: process.env.STORE_THANK_YOU ?? "Thank you for shopping with us.",
    storePhone: tenant?.storePhone ?? process.env.STORE_PHONE ?? null,
    storeAddress: tenant?.storeAddress ?? process.env.STORE_ADDRESS ?? null,
    storeLogoUrl: tenant?.storeLogoUrl ?? process.env.STORE_LOGO_URL ?? null,
    receiptFooter: tenant?.receiptFooter ?? process.env.STORE_RECEIPT_FOOTER ?? null,
    returnPolicy: tenant?.returnPolicy ?? process.env.STORE_RETURN_POLICY ?? null,
  });
});
