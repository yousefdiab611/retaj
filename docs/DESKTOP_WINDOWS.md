# Retaj Store — Windows Desktop Build

This document explains how the **standalone Windows installer** is
produced and what end-users actually get on their machines.

## Topology

A single `.exe` installer that bundles three things:

1. **Electron shell** — UI host, auto-updater, license storage,
   crash reporter.
2. **Backend (Node.js + Express + Prisma)** — runs as a child process
   _inside_ Electron via `ELECTRON_RUN_AS_NODE`, so we don't need a
   separate Node runtime on the user's machine.
3. **Embedded SQLite database** — Prisma talks to a local `retaj.db`
   file under `%APPDATA%/Retaj Store/data/`. No PostgreSQL install,
   no external service dependencies.

```
┌──────────────────────────────────────────────────────────┐
│  Retaj Store.exe (NSIS installer)                        │
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │ Electron main                                       │  │
│  │   • ensures encrypted license-store.json            │  │
│  │   • generates JWT_SECRET (machine-bound)            │  │
│  │   • prisma migrate deploy --schema prisma-desktop   │  │
│  │   • spawns backend (ELECTRON_RUN_AS_NODE=1)         │  │
│  │   • opens BrowserWindow → React UI                  │  │
│  └────────────────────────────────────────────────────┘  │
│             │                                            │
│             ▼                                            │
│  Express on 127.0.0.1:38217  ──►  Prisma  ──►  retaj.db │
└──────────────────────────────────────────────────────────┘
```

## Per-user paths on Windows

| Purpose                   | Location                                    |
| ------------------------- | ------------------------------------------- |
| SQLite database           | `%APPDATA%\Retaj Store\data\retaj.db`       |
| Encrypted license store   | `%APPDATA%\Retaj Store\license-store.json`  |
| Encrypted secrets store   | `%APPDATA%\Retaj Store\retaj-secrets.json`  |
| Electron logs             | `%APPDATA%\Retaj Store\logs\`               |

The user can open the data folder from the in-app menu (IPC channel
`open-data-folder`) — useful for backups.

## Building the installer

You have **three** options:

### Option 1 — GitHub Actions (recommended)

Tag a release and let CI do the cross-platform build:

```bash
git tag v1.2.0
git push origin v1.2.0
```

The `Desktop Release` workflow runs on `windows-latest`, executes:

1. `npm install`
2. `prisma generate` (Postgres types so backend compiles)
3. `node frontend/scripts/stage-desktop-backend.cjs`
   (rebuilds backend with SQLite Prisma client + Windows engines)
4. `npm run build:desktop:win`
   (electron-builder produces `Retaj-Store-Setup-1.2.0.exe`)

The artefact appears as **`retaj-desktop-windows`** under the workflow
run, and a GitHub Release is created automatically.

Trigger a one-off Windows build without tagging via the
`workflow_dispatch` UI in GitHub Actions (defaults to **Windows only**).

### Option 2 — Local Windows machine

Requirements: Node 20.18+, npm 10+, ~2GB free disk.

```powershell
git clone https://github.com/yousefdiab611/retaj.git
cd retaj
npm install
npm run build:desktop:win
```

The installer ends up at `dist-electron\Retaj-Store-Setup-<version>.exe`.

### Option 3 — Local macOS / Linux (cross-compile via Wine)

Possible but **not recommended** — Wine often produces flaky NSIS
binaries and Prisma's Windows query engine assumes a real Windows
toolchain in some edge cases. Use GitHub Actions instead.

## How the SQLite Prisma schema is produced

The canonical schema is the PostgreSQL one at
`backend/prisma/schema.prisma`. A small script derives the SQLite
variant on demand:

```bash
node backend/scripts/generate-sqlite-schema.cjs
```

Differences applied automatically:

- `provider = "postgresql"` → `provider = "sqlite"`
- `shadowDatabaseUrl` removed
- `binaryTargets = ["native", "windows", "debian-openssl-3.0.x", "linux-musl-openssl-3.0.x"]`
- `Json` / `Json?` → `String` / `String?`
- `String[] @default([])` → `String @default("[]")` (and similar for
  other primitive lists)

The `String`/JSON-encoded fields are read/written through helpers in
`backend/src/lib/jsonField.ts` so business code is portable across both
schemas.

## What's disabled in the standalone build

- **Stripe billing** — `STRIPE_SECRET_KEY` is set to empty by Electron
  main, so `isStripeConfigured()` returns false and all billing routes
  return 503 Service Unavailable. The license activation page handles
  desktop licenses directly via IPC.
- **Redis-backed rate limiting** — `REDIS_URL` is empty, so
  `loginBlocker` and `rateLimits` automatically fall back to their
  in-process implementations.
- **Scheduled DB backups** — `DISABLE_SCHEDULED_BACKUPS=1`.
- **PostgreSQL Docker recovery loop** — `DB_DOCKER_RECOVERY=0`.

These are all reflected in `frontend/electron/main.cjs:buildBackendEnv`.

## Updating the installed app

The Electron shell wires in `electron-updater` against the
`UPDATE_SERVER_URL` env variable (set at build time, typically pointing
at a generic static host or GitHub Releases). When a new version is
detected:

1. Background download
2. Renderer is notified via `update-downloaded` IPC event
3. User clicks "Restart now" → `quitAndInstall`
4. After restart, `prisma migrate deploy` runs again so any new
   migrations (added under `backend/prisma-desktop/migrations/`) are
   applied to the existing user database.

## Smoke testing the build locally on Windows

After installation:

1. Launch **Retaj Store** from the Start Menu.
2. Activate with a license key (or use the default seed admin if you
   ran `db:seed` against the staging DB).
3. Verify the backend is up by visiting `http://127.0.0.1:38217/health`
   in any browser — should return `{"status":"ok",...}`.
4. Make a sale on the POS page; confirm the row appears in the data
   folder's `retaj.db` (open with `sqlite3` or DB Browser).
5. Close and re-open the app — data persists across launches.
