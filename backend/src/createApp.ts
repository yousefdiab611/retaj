import "express-async-errors";

import cors from "cors";
import express, { type NextFunction, type Request, type Response, type Router } from "express";
import helmet from "helmet";
import { UserRole } from "@prisma/client";

import { getCorsOrigin } from "./config/cors";
import { AppError } from "./http/AppError";
import { logger } from "./lib/logger";
import { getDatabaseStatus, isDatabaseOnline } from "./lib/dbBootstrap";
import { isDatabaseUnavailableError } from "./lib/errors";
import { prisma } from "./lib/prisma";
import { apiRateLimiter, sensitiveWriteRateLimiter } from "./middleware/rateLimits";
import { requireAuth } from "./middleware/requireAuth";
import { requireRole } from "./middleware/requireRole";
import { sanitizeBody } from "./middleware/sanitizeBody";
import { resolveActiveBranch, requireBranchSelected } from "./middleware/branchContext";
import { adminRouter as adminCommercialRouter } from "./routes/admin-commercial";
import { customerRouter as customerCommercialRouter } from "./routes/customer-commercial";
import { billingRouter as billingCommercialRouter } from "./routes/billing-commercial";
import { backupRouter } from "./routes/backup";
import { healthRouter } from "./routes/health";
import { authRouter } from "./routes/auth";
import { billingRouter } from "./routes/billing";
import { branchesRouter } from "./routes/branches";
import { customersRouter } from "./routes/customers";
import { tenantsRouter } from "./routes/tenants";
import { settingsRouter } from "./routes/settings";
import { usersRouter } from "./routes/users";
import { reportsRouter } from "./routes/reports";
import { customerRouter } from "./routes/customer";
import { warehousesRouter } from "./routes/warehouses";
import { productsRouter } from "./routes/products";
import { transactionsRouter } from "./routes/transactions";
import { syncRouter } from "./routes/sync";
import { adminProductsRouter } from "./routes/adminProducts";
import { adminRouter } from "./routes/admin";
import { licenseRouter, publicLicenseRouter } from "./routes/licenses";
import { inventoryRouter } from "./routes/inventory";
import { stockRouter } from "./routes/stock";
import invoiceRouter from "./routes/invoices";
import { BackupService } from "./services/backup.service";

function buildApiRouter(): Router {
  const api = express.Router();

  api.use("/auth", authRouter);
  api.use("/licenses", publicLicenseRouter);
  api.use(apiRateLimiter);
  api.use("/billing", billingRouter);
  api.use(requireAuth);
  api.use(resolveActiveBranch);

  api.use("/branches", branchesRouter);
  api.use("/users", requireRole(UserRole.ADMIN, UserRole.TENANT_ADMIN), usersRouter);
  api.use("/tenants", requireRole(UserRole.SUPER_ADMIN), tenantsRouter);
  api.use("/settings", settingsRouter);
  api.use("/backup", backupRouter);
  api.use("/reports", reportsRouter);
  api.use("/customers", customersRouter);
  api.use("/admin", adminRouter);
  api.use("/customer", customerRouter);

  api.use("/warehouses", requireBranchSelected, warehousesRouter);
  api.use(
    "/stock",
    requireRole(UserRole.ADMIN, UserRole.MANAGER, UserRole.INVENTORY_MANAGER),
    requireBranchSelected,
    sensitiveWriteRateLimiter,
    stockRouter,
  );
  api.use(
    "/inventory",
    requireRole(UserRole.ADMIN, UserRole.MANAGER, UserRole.INVENTORY_MANAGER),
    requireBranchSelected,
    sensitiveWriteRateLimiter,
    inventoryRouter,
  );

  api.use("/products", requireBranchSelected, sensitiveWriteRateLimiter, productsRouter);
  api.use("/transactions", requireBranchSelected, sensitiveWriteRateLimiter, transactionsRouter);
  api.use("/sync", requireBranchSelected, sensitiveWriteRateLimiter, syncRouter);
  api.use("/invoices", sensitiveWriteRateLimiter, invoiceRouter);
  api.use(
    "/admin/products",
    requireRole(UserRole.ADMIN, UserRole.MANAGER, UserRole.TENANT_ADMIN),
    requireBranchSelected,
    adminProductsRouter,
  );

  api.use("/license", licenseRouter);

  return api;
}

export function createApp() {
  const app = express();

  app.disable("x-powered-by");
  if (process.env.TRUST_PROXY === "1") {
    app.set("trust proxy", true);
  }

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: "cross-origin" },
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", ...(process.env.NODE_ENV !== "production" ? ["'unsafe-inline'"] : [])],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
        },
      },
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
      },
      noSniff: true,
      xssFilter: true,
      referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    }),
  );
  app.use(
    cors({
      origin: getCorsOrigin(),
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: false, limit: "1mb" }));
  app.use((req, res, next) => {
    if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method) && !req.is("application/json")) {
      res.status(415).json({ error: "Content-Type must be application/json", code: "UNSUPPORTED_MEDIA_TYPE" });
      return;
    }
    next();
  });
  app.use(sanitizeBody);

  // Request timeout protection
  app.use((req, res, next) => {
    const timeout = setTimeout(() => {
      if (!res.headersSent) {
        res.status(408).json({ error: "Request timeout", code: "TIMEOUT" });
      }
    }, 30000); // 30 second timeout

    res.on('finish', () => clearTimeout(timeout));
    res.on('close', () => clearTimeout(timeout));
    next();
  });

  app.get("/health", (_req, res) => {
    res.json({ ok: true, service: "retaj-store-api", version: process.env.npm_package_version ?? "1.0.0" });
  });

  app.get("/api/ready", (_req, res) => {
    const dbStatus = getDatabaseStatus();
    if (!isDatabaseOnline()) {
      res.status(503).json({ ok: false, database: "unavailable", status: dbStatus });
      return;
    }
    res.json({ ok: true, database: "connected", status: dbStatus });
  });

  app.use("/api/health", healthRouter);

  app.get("/api/status", (_req, res) => {
    const dbStatus = getDatabaseStatus();
    res.json({ ok: true, status: dbStatus, syncEngine: dbStatus.syncEngineStatus });
  });

  const apiRouter = buildApiRouter();
  app.use("/api", apiRouter);
  app.use("/api/v1", apiRouter);

  app.use((_req, res) => {
    res.status(404).json({ error: "Not found", code: "NOT_FOUND" });
  });

  const backupService = new BackupService();
  backupService.scheduleBackups();

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ error: err.message, code: err.code ?? "APP_ERROR" });
      return;
    }
    if (isDatabaseUnavailableError(err)) {
      logger.warn({ err }, "database_unavailable");
      res.status(503).json({ error: "Database unavailable", code: "DB_UNAVAILABLE" });
      return;
    }
    logger.error({ err }, "unhandled_error");
    const body: { error: string; code: string; details?: string } = {
      error: "Internal server error",
      code: "INTERNAL",
    };
    if (process.env.NODE_ENV !== "production" && err instanceof Error) {
      body.details = err.message;
    }
    res.status(500).json(body);
  });

  return app;
}
