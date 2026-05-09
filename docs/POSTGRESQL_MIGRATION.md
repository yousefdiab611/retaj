# PostgreSQL Migration Guide for Retaj POS

This guide covers migrating the backend from SQLite to PostgreSQL and verifying Prisma.

## 1. Start local PostgreSQL services

From `d:\retaj\backend`:

```powershell
docker-compose up -d postgres postgres-shadow
```

## 2. Verify environment file

Ensure `backend/.env.development` exists and contains:

- `DATABASE_URL`
- `SHADOW_DATABASE_URL`
- `NODE_ENV=development`

The backend loads `.env.development` automatically for development.

## 3. Install dependencies

```powershell
cd d:\retaj\backend
npm install
```

## 4. Generate Prisma client

```powershell
npm run db:generate
```

## 5. Run migrations locally

```powershell
npm run db:migrate
```

If you need to deploy migrations in production:

```powershell
npm run db:migrate:prod
```

## 6. Open Prisma Studio

```powershell
npm run db:studio
```

## 7. Verify database health

Open browser to `http://localhost:5555` after `prisma studio` starts, or run:

```powershell
curl http://localhost:3001/api/ready
```

## 8. Root workspace commands

If you are running from the workspace root, use:

```powershell
npm --prefix backend run dev
npm --prefix backend run db:generate
npm --prefix backend run db:migrate
npm --prefix backend run db:studio
```

## 9. Connection pooling recommendation

For production, use a pooled PostgreSQL gateway such as `PgBouncer` and set your app's `DATABASE_URL` to the pooled endpoint.

## 10. Production cleanup

Keep `.env.production` secret and never commit it. Use the `.env.example` template for new installations.
