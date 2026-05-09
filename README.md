# Retaj Store

Multi-tenant Point-of-Sale, inventory, billing and licensing platform with
web, **desktop** (Windows/macOS/Linux via Electron) and mobile (Flutter)
clients backed by a Node.js + Prisma + PostgreSQL API.

| Workspace        | Stack                                            | Path                     |
| ---------------- | ------------------------------------------------ | ------------------------ |
| API server       | Node 20, Express, Prisma, Zod, pino, JWT, helmet | `backend/`               |
| Web + desktop UI | React 18, Vite, Tailwind, Radix, Electron 28     | `frontend/`              |
| Mobile cashier   | Flutter 3, sqflite, secure_storage               | `mobile_cashier/`        |
| Containers       | Docker (api + web), docker-compose for the stack | `infra/`, `*/Dockerfile` |
| CI / release     | GitHub Actions (CI, CodeQL, desktop release)     | `.github/`               |

## Quick start (local development)

> Pre-requisites: Node 20.18 (`nvm use`), Docker (for Postgres + Redis), npm 10+.

```bash
# 1. Install workspace dependencies and Husky hooks
npm install

# 2. Start the data plane (postgres, postgres-shadow, redis)
npm run docker:up

# 3. Configure env files from the templates
cp backend/.env.example backend/.env.development
cp frontend/.env.example frontend/.env.development

# 4. Apply DB migrations + seed demo data
npm run db:migrate
npm run db:seed

# 5. Run backend and frontend in two terminals
npm run dev:backend   # http://localhost:3001
npm run dev:frontend  # http://localhost:5173

# 6. Or run the desktop shell against the dev frontend
npm run dev:desktop
```

API docs are exposed at <http://localhost:3001/api/docs> when
`ENABLE_API_DOCS` is not set to `0`.

## Building & releasing

```bash
npm run lint            # eslint across both workspaces
npm run typecheck       # tsc --noEmit
npm test                # vitest in both workspaces
npm run build           # api (tsc) + web (vite)

# Desktop installers (per-platform; defaults to host OS)
npm run build:desktop          # current OS
npm run build:desktop:win      # NSIS + portable, x64 + ia32
npm run build:desktop:mac      # DMG + ZIP, x64 + arm64
npm run build:desktop:linux    # AppImage + deb, x64
```

CI runs everything except the desktop matrix on every push/PR.
Pushing a `v*.*.*` tag triggers `desktop-release.yml`, which builds
installers on Windows/macOS/Linux runners and publishes them to a
GitHub Release.

## Standalone Windows desktop

The repo also ships an Electron-based **standalone Windows installer**
that bundles the backend (Node + Prisma) and an embedded SQLite
database — no Postgres install required on the end-user's machine.
The full build / packaging story lives in
[`docs/DESKTOP_WINDOWS.md`](docs/DESKTOP_WINDOWS.md). TL;DR:

```bash
# tag a release → GitHub Actions builds the .exe automatically
git tag v1.2.0 && git push origin v1.2.0
```

## Documentation map

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — services, data flow,
  multi-tenant boundaries, offline sync.
- [`docs/SECURITY.md`](docs/SECURITY.md) — threat model, secret handling,
  reporting policy.
- [`docs/RUNBOOK.md`](docs/RUNBOOK.md) — operational checklists, on-call
  procedures, recovery scenarios.
- [`docs/CONTRIBUTING.md`](docs/CONTRIBUTING.md) — branch flow, commit
  conventions, code review.
- [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) — production deployment
  topology (Docker / Kubernetes), env reference.
- [`docs/POSTGRESQL_MIGRATION.md`](docs/POSTGRESQL_MIGRATION.md) — moving
  off the SQLite dev database.

## License

Proprietary — © Retaj Store. All rights reserved.
