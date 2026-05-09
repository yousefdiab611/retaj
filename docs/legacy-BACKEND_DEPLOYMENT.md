# Build and run

npm run build
npm start

# Or with PM2

pm2 start pm2.config.js --env production

## PostgreSQL production recommendations

- Use a dedicated PostgreSQL server or managed service.
- Use PgBouncer or another connection pooler in production to keep connection count bounded.
- Set `DATABASE_URL` to the pooled endpoint in production.
- Configure `SHADOW_DATABASE_URL` separately and do not share it with the primary application database.

## Optional pgAdmin support

- Run pgAdmin locally or in a separate container for database administration.
- Use the same production credentials as `DATABASE_URL`, but restrict access to admin users.
- Do not expose pgAdmin to the public internet without a VPN or protected tunnel.
