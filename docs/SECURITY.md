# Security policy

## Reporting a vulnerability

Email **security@retaj.local** with:

- Affected component (web, desktop, mobile, api, infra).
- Reproduction steps and the smallest payload that demonstrates the issue.
- Impact assessment (data exposure, RCE, billing bypass, etc.).

Please give us 90 days to remediate before public disclosure. We do not
operate a paid bug bounty at this time but will credit reporters in the
release notes if requested.

## Supported versions

Only the `main` branch and the latest tagged release receive security
fixes. Forks are out of scope.

## Hardening baseline

The repository ships with the following defaults:

- **Transport**: HSTS preload, helmet CSP locked to `self`, frameAncestors
  none, `Referrer-Policy: strict-origin-when-cross-origin`.
- **Auth**: bcrypt (10 rounds), JWT signed with HS256, refresh tokens
  hashed (sha256) before persistence, opaque 256-bit refresh secrets.
- **Brute-force**: per-IP login blocker with Redis mirror (see
  `docs/ARCHITECTURE.md#authentication`).
- **Rate limiting**: three-tier `express-rate-limit` with optional Redis
  store; sensitive write endpoints are scoped tighter.
- **Input validation**: every body / query is validated with Zod before
  the handler runs; unknown fields are stripped.
- **Errors**: Stack traces never leak to clients in production. All
  responses carry `requestId` for correlation.
- **Database**: Prisma parameterises every query. Migrations run in
  shadow DB to detect destructive drift.
- **Secrets**: `.env*` is git-ignored; only `*.example` files live in the
  repo. Production secrets must come from your secret manager
  (HashiCorp Vault, AWS Secrets Manager, Docker secrets, etc.).
- **Containers**: backend image runs as non-root (`app` UID), frontend
  uses nginx-alpine without root. Tini supervises PID 1 to forward
  signals.
- **Static analysis**: GitHub Actions CodeQL (`security-and-quality`
  query pack) runs on every push, PR and weekly cron.
- **Dependencies**: Dependabot raises grouped weekly PRs (eslint,
  sentry, types and security advisories).

## Secret rotation

| Secret                   | How to rotate                                                                                                                                 |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `JWT_SECRET`             | Generate via `openssl rand -base64 48`. Restart the API. All issued access tokens become invalid; clients must log in again.                  |
| `STRIPE_SECRET_KEY`      | Roll the key in the Stripe dashboard, redeploy with the new value.                                                                            |
| `STRIPE_WEBHOOK_SECRET`  | Update the endpoint in Stripe → copy new signing secret → redeploy.                                                                           |
| Database password        | Update the role in PostgreSQL, redeploy with new `DATABASE_URL`.                                                                              |
| Code-signing certificate | macOS: rotate Developer ID via App Store Connect. Windows: rotate EV cert with the CA. Update `CSC_LINK` / `CSC_KEY_PASSWORD` GitHub secrets. |

## Audit logs

All sensitive actions write to the `AuditLog` table via
`writeAuditLog`. Recommended export: ship the table to your SIEM
(Splunk, Datadog Security, ELK) on a 1-minute interval and configure
alerting for the following actions:

- `LOGIN_FAILURE` bursts ≥ 5 from one IP within 60s.
- `LICENSE_GENERATED` outside business hours.
- `TRANSACTION_VOID` exceeding daily threshold per cashier.
- `USER_PROMOTED` / role changes.
