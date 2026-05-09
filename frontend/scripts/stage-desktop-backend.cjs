#!/usr/bin/env node
/* eslint-disable no-console, @typescript-eslint/no-require-imports */
/**
 * Prepares a self-contained backend folder under
 * dist-electron-staging/backend that electron-builder can copy verbatim
 * into the Windows installer's resources.
 *
 * Steps:
 *   1. Refresh the SQLite Prisma schema from the canonical Postgres schema
 *   2. Compile the backend TypeScript while the dev Postgres client is
 *      still active (so types match the source code)
 *   3. Copy backend dist + prisma-desktop into a clean staging tree
 *   4. Write a slim package.json (production deps only, prisma config
 *      points at the desktop schema)
 *   5. Run `npm install --omit=dev` inside the staging tree so we get a
 *      flat, self-contained node_modules with no monorepo hoisting
 *   6. Run `prisma generate --schema=prisma-desktop/schema.prisma` so
 *      the bundled Prisma client and the Windows query engine are present
 *
 * The original backend/node_modules and the active Postgres client are
 * left untouched so dev workflows (npm run dev:backend) keep working.
 *
 * Re-run safely: dist-electron-staging/ is wiped at the start of every run.
 */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const BACKEND_SRC = path.join(REPO_ROOT, "backend");
const STAGING_ROOT = path.join(REPO_ROOT, "dist-electron-staging");
const STAGING_BACKEND = path.join(STAGING_ROOT, "backend");

function rimraf(target) {
  if (!fs.existsSync(target)) return;
  fs.rmSync(target, { recursive: true, force: true });
}

function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  fs.cpSync(from, to, { recursive: true });
}

function run(command, cwd) {
  console.log(`$ ${command}`);
  console.log(`  (in ${path.relative(REPO_ROOT, cwd) || "."})`);
  execSync(command, { cwd, stdio: "inherit", env: { ...process.env, npm_config_yes: "true" } });
}

function readBackendPackageJson() {
  const raw = fs.readFileSync(path.join(BACKEND_SRC, "package.json"), "utf8");
  return JSON.parse(raw);
}

function writeStagingPackageJson(srcPkg) {
  // Drop deps that are pure Postgres / external service infra and are
  // not used in the standalone desktop topology.
  const skipped = new Set(["redis", "rate-limit-redis", "stripe"]);
  const deps = Object.fromEntries(
    Object.entries(srcPkg.dependencies ?? {}).filter(([name]) => !skipped.has(name)),
  );

  const stripped = {
    name: srcPkg.name,
    version: srcPkg.version,
    private: true,
    main: "dist/index.js",
    dependencies: deps,
    devDependencies: {
      // Prisma is technically a devDep but we need the CLI inside the
      // staging tree to run `prisma generate` and `prisma migrate deploy`
      // at install / first-launch time.
      prisma: srcPkg.devDependencies?.prisma ?? "^6.6.0",
    },
    prisma: {
      schema: "prisma-desktop/schema.prisma",
    },
  };
  fs.writeFileSync(
    path.join(STAGING_BACKEND, "package.json"),
    JSON.stringify(stripped, null, 2) + "\n",
  );
}

function main() {
  console.log("==> staging desktop backend bundle");

  rimraf(STAGING_ROOT);
  fs.mkdirSync(STAGING_BACKEND, { recursive: true });

  console.log("--> refreshing SQLite Prisma schema");
  run("node scripts/generate-sqlite-schema.cjs", BACKEND_SRC);

  console.log("--> compiling backend TypeScript (uses Postgres types from dev tree)");
  run("npm run build", BACKEND_SRC);

  console.log("--> copying compiled backend + desktop schema into staging");
  copyDir(path.join(BACKEND_SRC, "dist"), path.join(STAGING_BACKEND, "dist"));
  copyDir(path.join(BACKEND_SRC, "prisma-desktop"), path.join(STAGING_BACKEND, "prisma-desktop"));

  const srcPkg = readBackendPackageJson();
  writeStagingPackageJson(srcPkg);

  console.log("--> installing production dependencies inside staging");
  run("npm install --omit=optional --no-audit --no-fund", STAGING_BACKEND);

  console.log("--> generating Prisma client (with Windows binary engine)");
  run(
    "node node_modules/prisma/build/index.js generate --schema=prisma-desktop/schema.prisma",
    STAGING_BACKEND,
  );

  console.log("==> staging complete:", STAGING_BACKEND);
}

main();
