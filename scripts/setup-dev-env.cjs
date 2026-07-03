#!/usr/bin/env node
/* eslint-disable no-console */

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");

const files = [
  {
    path: path.join(root, "backend", ".env.development"),
    label: "backend/.env.development",
    contents: `NODE_ENV=development
PORT=3001
TRUST_PROXY=0

DATABASE_URL="postgresql://retaj_user:retaj_pass@localhost:5432/retaj_store?schema=public"
SHADOW_DATABASE_URL="postgresql://retaj_user:retaj_pass@localhost:5433/retaj_store_shadow?schema=public"

JWT_SECRET="retaj_dev_secret_change_me_48_chars_min_local_only"
JWT_ACCESS_EXPIRES="12h"
JWT_REFRESH_DAYS="14"

ALLOWED_ORIGINS="http://localhost:5173,http://127.0.0.1:5173"

LOG_LEVEL=debug
LOG_PRETTY=1
LOG_FILE_PATH=./logs/retaj-api.log

SENTRY_DSN=
SENTRY_TRACES_SAMPLE_RATE=0.1
SENTRY_ENVIRONMENT=development

AUTH_LOGIN_MAX_ATTEMPTS=10
AUTH_REFRESH_MAX=60
API_RATE_MAX=800
API_WRITE_MAX=400

REDIS_URL="redis://localhost:6379"

STORE_NAME="Retaj"
STORE_CURRENCY="SAR"
STORE_TAX_LABEL="VAT (15%)"
STORE_THANK_YOU="شكراً لتسوقك معنا"

STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=

LICENSE_GRACE_DAYS=7

DB_DOCKER_RECOVERY=0
DB_RECOVERY_INTERVAL_MS=10000
`,
  },
  {
    path: path.join(root, "frontend", ".env.development"),
    label: "frontend/.env.development",
    contents: `VITE_API_URL=
VITE_SENTRY_DSN=
VITE_APP_RELEASE=dev
VITE_STRIPE_PUBLISHABLE_KEY=
`,
  },
];

for (const file of files) {
  if (fs.existsSync(file.path)) {
    console.log(`exists: ${file.label}`);
    continue;
  }

  fs.writeFileSync(file.path, file.contents, { mode: 0o600 });
  console.log(`created: ${file.label}`);
}
