# syntax=docker/dockerfile:1.7-labs

# ──────────────────────────────────────────────────────────
# Stage 1 — install + build Vite bundle
# ──────────────────────────────────────────────────────────
FROM node:26.3-alpine AS build
WORKDIR /app
ENV NPM_CONFIG_FUND=false NPM_CONFIG_AUDIT=false
COPY package.json package-lock.json* ./
RUN --mount=type=cache,target=/root/.npm npm ci
COPY . .
ARG VITE_API_URL=
ARG VITE_SENTRY_DSN=
ARG VITE_APP_RELEASE=
ENV VITE_API_URL=$VITE_API_URL \
    VITE_SENTRY_DSN=$VITE_SENTRY_DSN \
    VITE_APP_RELEASE=$VITE_APP_RELEASE
RUN npm run build

# ──────────────────────────────────────────────────────────
# Stage 2 — nginx static server
# ──────────────────────────────────────────────────────────
FROM nginx:1.27-alpine AS runtime
RUN addgroup -S app && adduser -S app -G app
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/healthz || exit 1
