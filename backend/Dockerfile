# syntax=docker/dockerfile:1.7-labs

# ──────────────────────────────────────────────────────────
# Stage 1 — install full dependency tree (incl. devDependencies)
# ──────────────────────────────────────────────────────────
FROM node:26.5-alpine AS deps
WORKDIR /app
ENV NPM_CONFIG_FUND=false NPM_CONFIG_AUDIT=false
RUN apk add --no-cache libc6-compat openssl
COPY package.json package-lock.json* ./
RUN --mount=type=cache,target=/root/.npm npm ci

# ──────────────────────────────────────────────────────────
# Stage 2 — generate Prisma client + compile TypeScript
# ──────────────────────────────────────────────────────────
FROM node:26.5-alpine AS build
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate --schema prisma/schema.postgresql.prisma \
 && npm run build

# ──────────────────────────────────────────────────────────
# Stage 3 — production image
# ──────────────────────────────────────────────────────────
FROM node:26.5-alpine AS runtime
ENV NODE_ENV=production \
    PORT=3001 \
    NPM_CONFIG_FUND=false \
    NPM_CONFIG_AUDIT=false
RUN apk add --no-cache libc6-compat openssl tini curl \
 && addgroup -S app && adduser -S app -G app
WORKDIR /app
COPY package.json package-lock.json* ./
RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev \
 && npm cache clean --force
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=build /app/dist ./dist
COPY prisma ./prisma
USER app
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS http://127.0.0.1:${PORT}/health || exit 1
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/index.js"]
