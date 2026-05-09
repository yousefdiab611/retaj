#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Derives a SQLite-compatible Prisma schema from the canonical
 * PostgreSQL schema so the desktop standalone build can ship with
 * an embedded database file (no Postgres install required on the
 * end-user's Windows machine).
 *
 * Transformations applied:
 *   - datasource provider: postgresql → sqlite
 *   - drop shadowDatabaseUrl (SQLite has no shadow concept)
 *   - generator binaryTargets: include native + windows so the engines
 *     are bundled correctly when packaged on a Windows runner
 *   - field types `Json?` / `Json` → `String?` / `String`
 *     (callers must JSON.stringify on write and JSON.parse on read;
 *     see backend/src/lib/jsonField.ts for the helpers)
 *
 * The generated file is written to backend/prisma/schema.sqlite.prisma
 * and is committed to the repo so CI / electron-builder can consume it
 * without re-running this script.
 */
const fs = require("fs");
const path = require("path");

const SOURCE = path.resolve(__dirname, "..", "prisma", "schema.prisma");
const TARGET = path.resolve(__dirname, "..", "prisma-desktop", "schema.prisma");

function transform(src) {
  let out = src;

  // Note: we keep the default output path (node_modules/.prisma/client)
  // and rely on a single Prisma client per backend process. The desktop
  // build runs a one-shot `prisma generate --schema=prisma-desktop/...`
  // BEFORE packaging, so the generated artefacts overwrite the Postgres
  // ones inside the bundled backend node_modules - which is exactly
  // what we want for the standalone Windows installer.
  out = out.replace(/generator\s+client\s*\{[\s\S]*?\}/, [
    "generator client {",
    "  provider      = \"prisma-client-js\"",
    "  binaryTargets = [\"native\", \"windows\", \"debian-openssl-3.0.x\", \"linux-musl-openssl-3.0.x\"]",
    "}",
  ].join("\n"));

  out = out.replace(/datasource\s+db\s*\{[\s\S]*?\}/, [
    "datasource db {",
    "  provider = \"sqlite\"",
    "  url      = env(\"DATABASE_URL\")",
    "}",
  ].join("\n"));

  // Json → String (handles "Json", "Json?" with arbitrary trailing whitespace).
  out = out.replace(/(\s)Json(\??)(\s)/g, "$1String$2$3");

  // SQLite has no native list/array support. Persist scalar arrays as a
  // JSON-encoded string and default to an empty JSON array. The handful
  // of consumers must JSON.parse on read; see lib/jsonField.ts helpers.
  out = out.replace(
    /(\s)(String|Int|Float|Boolean)\[\]([^\n]*)/g,
    (_match, lead, scalar, rest) => {
      const cleaned = rest
        .replace(/@default\(\[\]\)/, "@default(\"[]\")")
        .replace(/@default\(\[(.*?)\]\)/, (_m, inner) => {
          const safe = inner.replace(/"/g, '\\"').trim();
          return `@default("[${safe}]")`;
        });
      return `${lead}String${cleaned}`;
    },
  );

  return out;
}

function main() {
  if (!fs.existsSync(SOURCE)) {
    console.error(`Source schema not found at ${SOURCE}`);
    process.exit(1);
  }

  const src = fs.readFileSync(SOURCE, "utf8");
  const out = transform(src);
  const banner = [
    "// AUTO-GENERATED. Do not edit by hand.",
    "// Run `npm run prisma:sqlite:generate` (root) or",
    "// `node backend/scripts/generate-sqlite-schema.cjs` to refresh.",
    "// Source of truth: backend/prisma/schema.prisma",
    "",
    "",
  ].join("\n");

  fs.writeFileSync(TARGET, banner + out, "utf8");
  console.log(`wrote ${path.relative(process.cwd(), TARGET)}`);
}

main();
