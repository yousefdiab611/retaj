import { extendZodWithOpenApi, OpenApiGeneratorV3, OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";

import {
  branchCreateSchema,
  branchPatchSchema,
  createSaleBodySchema,
  loginBodySchema,
  offlineSyncBodySchema,
  patchUserBodySchema,
  tenantCreateSchema,
} from "../validation/schemas";

extendZodWithOpenApi(z);

export const openApiRegistry = new OpenAPIRegistry();

const BearerAuth = openApiRegistry.registerComponent("securitySchemes", "BearerAuth", {
  type: "http",
  scheme: "bearer",
  bearerFormat: "JWT",
});

const ErrorResponse = openApiRegistry.register(
  "ErrorResponse",
  z.object({
    error: z.string().openapi({ example: "Not found" }),
    code: z.string().openapi({ example: "NOT_FOUND" }),
    requestId: z.string().uuid().optional(),
    details: z.record(z.unknown()).optional(),
  }),
);

const HealthResponse = openApiRegistry.register(
  "HealthResponse",
  z.object({ ok: z.literal(true), service: z.string(), version: z.string() }),
);

const LoginResponse = openApiRegistry.register(
  "LoginResponse",
  z.object({
    accessToken: z.string(),
    refreshToken: z.string(),
    user: z.object({
      id: z.string(),
      username: z.string().nullable(),
      name: z.string(),
      role: z.string(),
      tenantId: z.string(),
      branchId: z.string().nullable(),
      tenantPlan: z.string(),
      tenantBillingStatus: z.string(),
      tenantPlanExpiresAt: z.string().nullable(),
      tenantRestricted: z.boolean(),
    }),
  }),
);

const SaleResponse = openApiRegistry.register(
  "SaleResponse",
  z.object({
    transaction: z.object({
      id: z.string(),
      reference: z.string(),
      subtotal: z.number(),
      discount: z.number(),
      tax: z.number(),
      total: z.number(),
      paymentMethod: z.string().nullable(),
      createdAt: z.string(),
    }),
  }),
);

openApiRegistry.registerPath({
  method: "get",
  path: "/health",
  summary: "Liveness probe — does not require auth or DB.",
  responses: {
    200: { description: "Healthy", content: { "application/json": { schema: HealthResponse } } },
  },
});

openApiRegistry.registerPath({
  method: "get",
  path: "/api/ready",
  summary: "Readiness probe (database connectivity).",
  responses: {
    200: { description: "Ready", content: { "application/json": { schema: HealthResponse } } },
    503: { description: "Database unavailable", content: { "application/json": { schema: ErrorResponse } } },
  },
});

openApiRegistry.registerPath({
  method: "post",
  path: "/api/auth/login",
  summary: "Exchange username + password for an access/refresh token pair.",
  request: {
    body: { content: { "application/json": { schema: loginBodySchema } } },
  },
  responses: {
    200: { description: "Authenticated", content: { "application/json": { schema: LoginResponse } } },
    401: { description: "Invalid credentials", content: { "application/json": { schema: ErrorResponse } } },
    429: { description: "Too many attempts", content: { "application/json": { schema: ErrorResponse } } },
  },
});

openApiRegistry.registerPath({
  method: "post",
  path: "/api/transactions",
  summary: "Create a sale transaction (cash/card/account/split). Idempotent via idempotencyKey.",
  security: [{ [BearerAuth.name]: [] }],
  request: {
    body: { content: { "application/json": { schema: createSaleBodySchema } } },
  },
  responses: {
    201: { description: "Sale created", content: { "application/json": { schema: SaleResponse } } },
    400: {
      description: "Validation or business error",
      content: { "application/json": { schema: ErrorResponse } },
    },
    401: { description: "Unauthorised", content: { "application/json": { schema: ErrorResponse } } },
    409: {
      description: "Stock race or idempotency conflict",
      content: { "application/json": { schema: ErrorResponse } },
    },
  },
});

openApiRegistry.registerPath({
  method: "post",
  path: "/api/sync",
  summary: "Submit a batch of offline-captured sales for replay.",
  security: [{ [BearerAuth.name]: [] }],
  request: {
    body: { content: { "application/json": { schema: offlineSyncBodySchema } } },
  },
  responses: {
    200: {
      description: "Batch processed",
      content: { "application/json": { schema: z.object({ results: z.array(z.unknown()) }) } },
    },
  },
});

openApiRegistry.registerPath({
  method: "post",
  path: "/api/branches",
  summary: "Create a branch under the caller's tenant.",
  security: [{ [BearerAuth.name]: [] }],
  request: { body: { content: { "application/json": { schema: branchCreateSchema } } } },
  responses: { 201: { description: "Branch created" } },
});

openApiRegistry.registerPath({
  method: "patch",
  path: "/api/branches/{id}",
  summary: "Update a branch.",
  security: [{ [BearerAuth.name]: [] }],
  request: {
    params: z.object({ id: z.string() }),
    body: { content: { "application/json": { schema: branchPatchSchema } } },
  },
  responses: { 200: { description: "Branch updated" } },
});

openApiRegistry.registerPath({
  method: "post",
  path: "/api/tenants",
  summary: "(SUPER_ADMIN) Create a new tenant.",
  security: [{ [BearerAuth.name]: [] }],
  request: { body: { content: { "application/json": { schema: tenantCreateSchema } } } },
  responses: { 201: { description: "Tenant created" } },
});

openApiRegistry.registerPath({
  method: "patch",
  path: "/api/users/{id}",
  summary: "Update a user (admin/tenant admin only).",
  security: [{ [BearerAuth.name]: [] }],
  request: {
    params: z.object({ id: z.string() }),
    body: { content: { "application/json": { schema: patchUserBodySchema } } },
  },
  responses: { 200: { description: "User updated" } },
});

export function generateOpenApiDocument() {
  const generator = new OpenApiGeneratorV3(openApiRegistry.definitions);
  return generator.generateDocument({
    openapi: "3.0.3",
    info: {
      title: "Retaj Store API",
      version: process.env.npm_package_version ?? "1.0.0",
      description:
        "REST API for the Retaj Store multi-tenant POS, inventory and billing platform. " +
        "All write endpoints require Bearer JWT obtained from /api/auth/login.",
      contact: { name: "Retaj Store", email: "support@retaj.local" },
    },
    servers: [
      { url: "http://localhost:3001", description: "Local development" },
      { url: "/api", description: "Same-origin (mounted via reverse proxy)" },
    ],
    tags: [
      { name: "Auth" },
      { name: "Sales" },
      { name: "Inventory" },
      { name: "Tenants" },
      { name: "Billing" },
      { name: "Health" },
    ],
  });
}
