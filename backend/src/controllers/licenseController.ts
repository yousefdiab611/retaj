import { activateLicense, createLicenseRecord, validateLicense } from "../services/license.service";
import { getClientIp, getUserAgent } from "../utils/requestMeta";
import { licenseActivateSchema, licenseGenerateSchema, licenseValidateSchema } from "../validation/schemas";

import type { Request, Response } from "express";

export const licenseController = {
  async activate(req: Request, res: Response) {
    const parsed = licenseActivateSchema.safeParse(req.body);
    if (!parsed.success) {
      res
        .status(400)
        .json({ error: "Validation failed", code: "VALIDATION", details: parsed.error.flatten() });
      return;
    }
    const ip = getClientIp(req);
    const userAgent = getUserAgent(req);
    const result = await activateLicense(
      parsed.data.licenseKey,
      parsed.data.deviceId,
      parsed.data.deviceFingerprint,
      {
        ip,
        userAgent,
      },
    );
    if (!result.ok) {
      res.status(400).json({ error: result.reason, code: "LICENSE_INVALID" });
      return;
    }
    res.json(result);
  },

  async validate(req: Request, res: Response) {
    const parsed = licenseValidateSchema.safeParse(req.body);
    if (!parsed.success) {
      res
        .status(400)
        .json({ error: "Validation failed", code: "VALIDATION", details: parsed.error.flatten() });
      return;
    }
    const result = await validateLicense(
      parsed.data.licenseKey,
      parsed.data.deviceId,
      parsed.data.deviceFingerprint,
    );
    if (!result.ok) {
      res.status(400).json({ error: result.reason, code: "LICENSE_INVALID" });
      return;
    }
    res.json(result);
  },

  async generate(req: Request, res: Response) {
    const parsed = licenseGenerateSchema.safeParse(req.body);
    if (!parsed.success) {
      res
        .status(400)
        .json({ error: "Validation failed", code: "VALIDATION", details: parsed.error.flatten() });
      return;
    }
    const tenantId = parsed.data.tenantId ?? req.userTenantId;
    if (!tenantId) {
      res.status(400).json({ error: "Tenant not available", code: "TENANT_REQUIRED" });
      return;
    }
    const expiresAt = parsed.data.expiresInDays
      ? new Date(Date.now() + parsed.data.expiresInDays * 24 * 60 * 60 * 1000)
      : null;
    const license = await createLicenseRecord({
      tenantId,
      expiresAt,
      trialMode: parsed.data.trialMode ?? false,
      graceDays: parsed.data.graceDays,
    });
    res.json(license);
  },
};
