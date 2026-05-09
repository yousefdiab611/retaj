# Architecture

> Last updated: 2026-05-09. Owner: platform team.

Retaj Store is split into four deployable units that share a single
PostgreSQL schema and a stateless REST API:

```
┌──────────────────────────┐  ┌──────────────────────────┐
│ Web SPA (React + Vite)   │  │ Mobile cashier (Flutter) │
│  served by nginx (8080)  │  │  Android/iOS, sqflite     │
└────────────┬─────────────┘  └─────────────┬─────────────┘
             │ HTTPS (REST + JWT)            │
             ▼                               ▼
       ┌─────────────────────────────────────────────┐
       │  API service (Express, port 3001)           │
       │  helmet, rate-limit, requestContext         │
       │  Zod validation, Prisma ORM, Sentry          │
       └────────────┬──────────────────┬──────────────┘
                    │                  │
                    ▼                  ▼
           ┌──────────────┐    ┌──────────────┐
           │ PostgreSQL 16│    │ Redis 7      │
           │ + shadow DB  │    │ rate limit + │
           │              │    │ login blocker│
           └──────────────┘    └──────────────┘

       ┌─────────────────────────────────────────────┐
       │ Desktop shell (Electron 28)                 │
       │ packages frontend dist + spawns local API   │
       │ machineId-bound license store (electron-store) │
       └─────────────────────────────────────────────┘
```

## Multi-tenancy

Every domain row carries a `tenantId`. Auth middleware
(`src/middleware/requireAuth.ts`) loads the user, asserts the tenant is
active, and attaches `tenantId`/`tenantPlan`/`tenantBillingStatus` to the
request. Every Prisma query in business services scopes by
`tenantId`; super-admin endpoints are explicitly opt-in via
`requireRole(UserRole.SUPER_ADMIN)`.

Branches sit one level below tenants. Cashiers are pinned to a single
branch; admins/managers can switch via `branchContext` middleware.

## Pricing engine

`src/lib/saleMath.ts` is the canonical pure function for sale totals
(subtotal, discount clamp, tax, partial payment, status). It is consumed
by `transactionSale.service.ts` and unit-tested in
`tests/lib/saleMath.test.ts`. **All money math must live here**, never
in route handlers.

Numerical safety: `lib/money.ts#roundMoney2` is used everywhere a value
is persisted as Prisma `Decimal`. Decimal columns are converted via
`new Prisma.Decimal(toDecimalString(n))` to avoid floating-point drift.

## Idempotency & offline sync

POS clients (web + mobile + desktop) generate a UUID
`idempotencyKey` per sale before sending. The server stores it on the
`Transaction` row (unique index). Replays return the existing
transaction unchanged with `idempotentReplay=true`.

`OfflineSyncDaemon` (frontend/src/components) pushes queued sales when
connectivity returns. The mobile app uses `pending_sales_store.dart`
(sqflite) for the same purpose. Both call `POST /api/sync` which loops
through items via `processOfflineSyncBatch` and writes a single audit
log entry per batch.

## Authentication

- Username + password → bcrypt verify.
- `signAccessToken` issues a JWT (`sub` only) signed with `JWT_SECRET`.
  Default TTL: 15 min in production, 12 h in development.
- Refresh tokens are 256-bit opaque values stored hashed in
  `RefreshToken`. Rotation/expiry is enforced by `auth.service.ts`.
- Brute-force protection: `lib/loginBlocker.ts` increments a per-IP
  counter (in-process map + Redis mirror). After
  `AUTH_LOGIN_MAX_ATTEMPTS` failures the IP is blocked for
  `AUTH_BLOCK_DURATION_MINUTES`.

## Rate limiting

Three buckets defined in `middleware/rateLimits.ts`:

| Bucket          | Default cap          | Scope                          |
| --------------- | -------------------- | ------------------------------ |
| `apiRateLimiter`        | 800 req / 15 min  | All `/api` traffic              |
| `sensitiveWriteRateLimiter` | 400 writes / 15 min | Stock, inventory, products, transactions, sync, invoices |
| `refreshRateLimiter`    | 60 / hour         | `POST /api/auth/refresh`        |

When `REDIS_URL` is set the buckets are backed by `rate-limit-redis`,
otherwise they fall back to `express-rate-limit`'s in-memory store
(single instance only).

## Observability

- Structured pino logs with file rotation (`LOG_FILE_PATH`).
  `requestContext` middleware emits `http_request` lines with
  `requestId`, latency, status and user/tenant ids.
- Sentry (`@sentry/node` and `@sentry/react`) is initialised when
  `SENTRY_DSN` / `VITE_SENTRY_DSN` are set. Configurable sample rates,
  PII never sent.
- Health endpoints:
  - `GET /health` — liveness, no DB.
  - `GET /api/ready` — readiness, returns 503 when Prisma is offline.
  - `GET /api/status` — extended status (sync engine, db provider).

## Data flow: POS sale

```
Browser/POS  →  POST /api/transactions
              ├─ requireAuth (JWT)
              ├─ resolveActiveBranch
              ├─ requireBranchSelected
              ├─ sensitiveWriteRateLimiter
              ├─ Zod validate (createSaleBodySchema)
              └─ transactionSale.service
                   ├─ idempotencyKey check (Transaction unique)
                   ├─ resolveWarehouseIdForSale
                   ├─ Prisma.$transaction:
                   │     • find products + variants
                   │     • computeSaleTotals (pure)
                   │     • create Transaction + line items
                   │     • decrement stock with optimistic
                   │       quantity guard (STOCK_RACE if 0)
                   │     • write StockMovement rows
                   │     • update customer balance + ledger
                   └─ writeAuditLog
```

## Desktop shell

Electron `main.cjs` spawns the bundled backend (`process.execPath` in a
packaged build) and serves the Vite-built SPA from `app://`. License
material is encrypted at rest via `electron-store` using a key derived
from the device's `machineIdSync()` (hashed with SHA-256). Renderer
process runs sandboxed with `contextIsolation: true` and a small
`preload.cjs` exposing only the IPC bridge.

Auto-update flow: `electron-updater` polls `UPDATE_SERVER_URL` (generic
provider). The Desktop Release workflow uploads `latest*.yml` plus the
installer artefacts so updates flow through any static host.
