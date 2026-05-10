import "express-async-errors";

import { UserRole } from "@prisma/client";
import cors from "cors";
import express, { type NextFunction, type Request, type Response, type Router } from "express";
import helmet from "helmet";
import { ZodError } from "zod";

import { getCorsOrigin } from "./config/cors";
import { billingController } from "./controllers/billingController";
import { AppError } from "./http/AppError";
import { getDatabaseStatus, isDatabaseOnline } from "./lib/dbBootstrap";
import { isDatabaseUnavailableError } from "./lib/errors";
import { logger } from "./lib/logger";
import { sentryErrorHandler, sentryRequestHandler } from "./lib/observability";
import { resolveActiveBranch, requireBranchSelected } from "./middleware/branchContext";
import { apiRateLimiter, sensitiveWriteRateLimiter } from "./middleware/rateLimits";
import { requestContext } from "./middleware/requestContext";
import { requireAuth } from "./middleware/requireAuth";
import { requireRole } from "./middleware/requireRole";
import { sanitizeBody } from "./middleware/sanitizeBody";
import { adminRouter } from "./routes/admin";
import { adminRouter as adminCommercialRouter } from "./routes/admin-commercial";
import { adminProductsRouter } from "./routes/adminProducts";
import { authRouter } from "./routes/auth";
import { backupRouter } from "./routes/backup";
import { billingRouter } from "./routes/billing";
import { billingRouter as billingCommercialRouter } from "./routes/billing-commercial";
import { branchesRouter } from "./routes/branches";
import { customerRouter } from "./routes/customer";
import { customerRouter as customerCommercialRouter } from "./routes/customer-commercial";
import { customersRouter } from "./routes/customers";
import { docsRouter } from "./routes/docs";
import { healthRouter } from "./routes/health";
import { inventoryRouter } from "./routes/inventory";
import invoiceRouter from "./routes/invoices";
import { licenseRouter, publicLicenseRouter } from "./routes/licenses";
import { productsRouter } from "./routes/products";
import { reportsRouter } from "./routes/reports";
import { settingsRouter } from "./routes/settings";
import { setupRouter } from "./routes/setup";
import { stockRouter } from "./routes/stock";
import { syncRouter } from "./routes/sync";
import { tenantsRouter } from "./routes/tenants";
import { transactionsRouter } from "./routes/transactions";
import { usersRouter } from "./routes/users";
import { warehousesRouter } from "./routes/warehouses";
import { BackupService } from "./services/backup.service";

const REQUEST_BODY_LIMIT = process.env.REQUEST_BODY_LIMIT ?? "1mb";
const REQUEST_TIMEOUT_MS = Number(process.env.REQUEST_TIMEOUT_MS ?? 30_000);

function buildApiRouter(): Router {
  const api = express.Router();

  api.use("/auth", authRouter);
  api.use("/licenses", publicLicenseRouter);
  // First-run provisioning: must be reachable before auth on a fresh DB.
  // The handlers themselves self-lock once any user exists.
  api.use("/setup", setupRouter);
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

  // Mounted but unused router placeholders kept for future commercial APIs.
  void adminCommercialRouter;
  void billingCommercialRouter;
  void customerCommercialRouter;

  return api;
}

export function createApp() {
  const app = express();

  app.disable("x-powered-by");
  if (process.env.TRUST_PROXY === "1") {
    app.set("trust proxy", true);
  }

  app.use(requestContext);
  app.use(sentryRequestHandler());

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: "cross-origin" },
      crossOriginEmbedderPolicy: false,
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", ...(process.env.NODE_ENV !== "production" ? ["'unsafe-inline'"] : [])],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "blob:", "https:"],
          connectSrc: ["'self'", "https:", "wss:"],
          fontSrc: ["'self'", "data:", "https:"],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
          frameAncestors: ["'none'"],
        },
      },
      hsts: {
        maxAge: 31_536_000,
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
      exposedHeaders: ["x-request-id"],
    }),
  );

  // ──────────────────────────────────────────────────────────────────
  // Stripe webhook MUST receive the raw bytes so signature verification
  // can succeed. It is mounted BEFORE the JSON body parser.
  // ──────────────────────────────────────────────────────────────────
  app.post(
    "/api/billing/webhook/stripe",
    express.raw({ type: "application/json", limit: "2mb" }),
    (req, res) => void billingController.handleStripeWebhook(req, res),
  );
  app.post(
    "/api/v1/billing/webhook/stripe",
    express.raw({ type: "application/json", limit: "2mb" }),
    (req, res) => void billingController.handleStripeWebhook(req, res),
  );

  app.use(express.json({ limit: REQUEST_BODY_LIMIT }));
  app.use(express.urlencoded({ extended: false, limit: REQUEST_BODY_LIMIT }));
  app.use((req, res, next) => {
    if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method) && !req.is("application/json")) {
      res.status(415).json({
        error: "Content-Type must be application/json",
        code: "UNSUPPORTED_MEDIA_TYPE",
        requestId: req.requestId,
      });
      return;
    }
    next();
  });
  app.use(sanitizeBody);

  app.use((req, res, next) => {
    const timeout = setTimeout(() => {
      if (!res.headersSent) {
        res.status(408).json({ error: "Request timeout", code: "TIMEOUT", requestId: req.requestId });
      }
    }, REQUEST_TIMEOUT_MS);
    res.on("finish", () => clearTimeout(timeout));
    res.on("close", () => clearTimeout(timeout));
    next();
  });

  app.get("/health", (_req, res) => {
    res.json({
      ok: true,
      service: "retaj-store-api",
      version: process.env.npm_package_version ?? "1.0.0",
    });
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

  if (process.env.ENABLE_API_DOCS !== "0") {
    app.use("/api/docs", docsRouter);
  }

  app.get("/api/status", (_req, res) => {
    const dbStatus = getDatabaseStatus();
    res.json({ ok: true, status: dbStatus, syncEngine: dbStatus.syncEngineStatus });
  });

  const apiRouter = buildApiRouter();
  app.use("/api", apiRouter);
  app.use("/api/v1", apiRouter);

  app.use((req, res) => {
    res.status(404).json({ error: "Not found", code: "NOT_FOUND", requestId: req.requestId });
  });

  if (process.env.DISABLE_SCHEDULED_BACKUPS !== "1") {
    const backupService = new BackupService();
    backupService.scheduleBackups();
  }

  app.use(sentryErrorHandler());

  app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
    const requestId = req.requestId;

    if (err instanceof AppError) {
      res.status(err.statusCode).json({ error: err.message, code: err.code ?? "APP_ERROR", requestId });
      return;
    }

    if (err instanceof ZodError) {
      res.status(400).json({
        error: "Validation failed",
        code: "VALIDATION",
        details: err.flatten(),
        requestId,
      });
      return;
    }

    if (isDatabaseUnavailableError(err)) {
      logger.warn({ err, requestId }, "database_unavailable");
      res.status(503).json({ error: "Database unavailable", code: "DB_UNAVAILABLE", requestId });
      return;
    }

    logger.error({ err, requestId, url: req.originalUrl, method: req.method }, "unhandled_error");
    const body: { error: string; code: string; requestId: string; details?: string } = {
      error: "Internal server error",
      code: "INTERNAL",
      requestId,
    };
    if (process.env.NODE_ENV !== "production" && err instanceof Error) {
      body.details = err.message;
    }
    res.status(500).json(body);
  });

  return app;
}
