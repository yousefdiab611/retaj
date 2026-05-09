# Deployment

## Recommended topology

```
            ┌────────────────────────┐
  Internet ─┤  Cloudflare / WAF      │── TLS termination, edge cache
            └──────────┬─────────────┘
                       │
            ┌──────────┴─────────────┐
            │  nginx / ingress       │── routes /api → api pods, / → web pods
            └──────┬──────────┬──────┘
                   │          │
        ┌──────────┴──┐   ┌───┴─────────┐
        │ web pod x N │   │ api pod x N │── horizontal scale
        │ (nginx)     │   │ (Node 20)   │
        └─────────────┘   └──┬──────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
      ┌─────────────┐ ┌────────────┐ ┌───────────────┐
      │ PostgreSQL  │ │ PgBouncer  │ │ Redis cluster │
      │  primary    │ │ (pooling)  │ │  (rate limit, │
      │ + replicas  │ └────────────┘ │   sessions)   │
      └─────────────┘                └───────────────┘
```

## Environment matrix

| Variable                    | API | Web | Desktop |
| --------------------------- | --- | --- | ------- |
| `DATABASE_URL`              | ✅  |     | (when local backend) |
| `SHADOW_DATABASE_URL`       | ✅* |     |         |
| `JWT_SECRET`                | ✅  |     | (passed to bundled backend) |
| `ALLOWED_ORIGINS`           | ✅  |     |         |
| `REDIS_URL`                 | ✅* |     |         |
| `STRIPE_SECRET_KEY`         | ✅* |     |         |
| `STRIPE_WEBHOOK_SECRET`     | ✅* |     |         |
| `SENTRY_DSN`                | ✅* |     | ✅*     |
| `LOG_LEVEL`                 | ✅  |     |         |
| `LOG_FILE_PATH`             | ✅* |     |         |
| `API_RATE_MAX` / `API_WRITE_MAX` | ✅* |  |        |
| `AUTH_LOGIN_MAX_ATTEMPTS`   | ✅* |     |         |
| `TRUST_PROXY=1`             | ✅* |     |         |
| `VITE_API_URL`              |     | ✅  | (build time) |
| `VITE_SENTRY_DSN`           |     | ✅* | ✅*     |
| `UPDATE_SERVER_URL`         |     |     | ✅*     |

`✅` required, `✅*` recommended / context-dependent.

## Deploying with Docker Compose

```bash
# Set required secrets in your shell or a .env file at repo root
export JWT_SECRET=$(openssl rand -base64 48)
export ALLOWED_ORIGINS=https://pos.example.com
export VITE_API_URL=/api
export API_IMAGE=ghcr.io/yousefdiab611/retaj-api:1.2.3
export WEB_IMAGE=ghcr.io/yousefdiab611/retaj-web:1.2.3

docker compose \
  -f infra/docker-compose.yml \
  -f infra/docker-compose.prod.yml \
  --profile app pull
docker compose \
  -f infra/docker-compose.yml \
  -f infra/docker-compose.prod.yml \
  --profile app up -d --remove-orphans
```

## Deploying with Kubernetes (sketch)

1. Push the api/web images via the CI Docker-buildx job (extend the
   workflow to push to GHCR / ECR).
2. Use a `Deployment` per workload with `readinessProbe` =
   `/api/ready` (api) and `/healthz` (web).
3. Mount secrets via `Secret` (`JWT_SECRET`, `DATABASE_URL`,
   `REDIS_URL`, etc.). Never bake them into the image.
4. Run a `Job` to apply Prisma migrations (`npm run db:migrate:prod`)
   before scaling up the new ReplicaSet.
5. Configure `HorizontalPodAutoscaler` on CPU + custom Sentry latency
   metric.

## Behind a reverse proxy

- Set `TRUST_PROXY=1` so the API uses the `X-Forwarded-For` header for
  rate limiting, login blocking and audit logs.
- Configure your edge to forward the `x-request-id` header so traces
  span the full hop.
- Disable buffering for `/api/sync` and `/api/transactions` so partial
  uploads do not exceed the 30 s `REQUEST_TIMEOUT_MS`.

## Backups & disaster recovery

See [`RUNBOOK.md`](RUNBOOK.md) §3 and §5. Minimum: nightly logical
dumps to off-site object storage and weekly restore drills.

## Releasing the desktop app

The desktop installers come from the `Desktop Release` workflow. They
publish to a generic provider (any HTTPS host that serves `latest.yml`,
`latest-mac.yml`, `latest-linux.yml` and the binaries). Set
`UPDATE_SERVER_URL` on shipped builds so users get auto-updates.
