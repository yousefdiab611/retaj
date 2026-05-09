# Operations runbook

> Use this as the on-call cheat sheet. Each playbook is intentionally short.

## 1. Health probes

| URL                   | Meaning                          | Expected response                  |
| --------------------- | -------------------------------- | ---------------------------------- |
| `GET /health`         | Liveness, no DB                  | `{"ok":true,"service":"retaj-store-api"}` |
| `GET /api/ready`      | Readiness (DB online)            | 200 with `database: "connected"`   |
| `GET /api/status`     | Detailed (sync engine, provider) | JSON with `syncEngineStatus`       |
| `GET /healthz` (web)  | nginx static probe               | `ok`                               |

Datadog / Cloud Run / ECS configurations should target `/api/ready` for
readiness and `/health` for liveness.

## 2. Common alerts

### "API readiness failing" (503 from `/api/ready`)

1. Inspect the latest `dbStatus` returned by `/api/status`.
2. Check the database service: `docker compose ... ps postgres`.
3. If Postgres is healthy, look at `logs/retaj-api.log` for
   `prisma_connection_unavailable`.
4. Restart the API: `pm2 restart retaj-api` (or `kubectl rollout
   restart deployment/retaj-api`).

### "Login attempts spiking"

1. `grep "AUTH_FAILED\|LOGIN_FAILURE" logs/retaj-api.log | tail -50`.
2. Identify offending IPs.
3. Confirm the in-cluster blocker: hit `redis-cli KEYS "retaj:loginblock:*"`.
4. If brute force is real, add the source range to the WAF/Cloudflare
   rule and (optionally) raise `AUTH_BLOCK_DURATION_MINUTES`.

### "Stripe webhook signature failed"

1. Verify the route is mounted before `express.json()` (regression
   guard in `createApp.ts`).
2. Check `STRIPE_WEBHOOK_SECRET` matches the endpoint shown in the
   Stripe dashboard.
3. Replay the event from Stripe → look for `webhook_received` log
   line.

## 3. Database operations

### Backups

`BackupService.scheduleBackups()` runs every 6 hours by default. Output
lives in `backend/backups/`. **Do not skip** off-site replication: copy
this directory to S3 / GCS / Azure Blob nightly.

Manual backup:

```bash
pg_dump -Fc "$DATABASE_URL" > /backups/retaj-$(date +%F-%H%M).dump
```

### Restore

```bash
createdb retaj_store_restore
pg_restore -d retaj_store_restore /backups/retaj-2026-05-09-0300.dump
DATABASE_URL=postgresql://...:.../retaj_store_restore npm run start  # smoke test
```

### Migrations

```bash
npm run db:migrate          # local (sqlite dev schema)
npm --workspace backend run db:migrate:prod   # production (postgres + shadow db)
```

Do **not** run `prisma migrate dev` in production — it is allowed to
drop/recreate tables. Only `migrate deploy` is safe.

## 4. Releasing the desktop app

1. Cut a release branch from `main` and bump versions.
2. Push the tag: `git push origin v1.2.3`.
3. Watch `desktop-release.yml`. Failures usually come from missing
   code-signing secrets — check `CSC_LINK`, `CSC_KEY_PASSWORD`,
   `APPLE_*`.
4. Once artefacts are uploaded, sync them to the update channel host
   (`UPDATE_SERVER_URL`) so existing installs auto-update.
5. Smoke test on each OS using the published installer; run through
   the licence activation, login, sale, refund happy paths.

## 5. Disaster recovery

| Scenario                     | RPO    | RTO   | Action |
| ---------------------------- | ------ | ----- | ------ |
| API container crash loop     | 0      | 5 min | `pm2 restart` / k8s rollback to previous image |
| Postgres node failure        | 5 min  | 30 min| Promote read replica or restore last `pg_dump` |
| Region-wide outage           | 1 h    | 4 h   | Spin up secondary region from latest backup; flip DNS |
| Compromised JWT secret       | n/a    | 30 min| Rotate `JWT_SECRET`, force-revoke all refresh tokens (`UPDATE refresh_tokens SET revoked_at = NOW();`), redeploy |
| Compromised Stripe key       | 0      | 15 min| Roll key in dashboard, redeploy, audit `Payment` rows since the leak window |

## 6. Useful commands

```bash
# Inspect the live config
curl -s http://localhost:3001/api/status | jq

# Tail the API
docker logs -f retaj-api

# Open Prisma studio against production carefully (read-only role!)
DATABASE_URL=postgresql://readonly@... npm --workspace backend run db:studio:prod
```
