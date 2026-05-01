# services/digital-twin-ui/Dockerfile
#
# Multi-stage:
#   1. node:20-alpine    — npm ci + vite build → /app/dist
#   2. nginx:1.27-alpine — serve dist + /healthz; SPA fallback. (No /api proxy
#                          today; UI calls copilot-api directly via
#                          VITE_API_BASE_URL.)
#
# Build context MUST be the repo root. The Dockerfile copies from
# `services/digital-twin-ui/*` paths; building with the service dir as the
# context will fail with "no such file or directory". Matches scripts that
# build with `-f services/digital-twin-ui/Dockerfile` from the repo root.

# ─── 1. build ────────────────────────────────────────────
FROM docker.io/library/node:20-alpine AS build
WORKDIR /app
# Copy manifest first for layer caching.
COPY services/digital-twin-ui/package.json services/digital-twin-ui/package-lock.json* ./
RUN npm ci --no-audit --no-fund
COPY services/digital-twin-ui/ ./
RUN npm run build

# ─── 2. serve ────────────────────────────────────────────
FROM docker.io/library/nginx:1.27-alpine AS serve
# Drop the default nginx config; ship our own that adds `/healthz` (returns
# 200) for k8s probes, and serves the SPA with proper SPA-fallback.
RUN rm /etc/nginx/conf.d/default.conf
COPY services/digital-twin-ui/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
# nginx already runs as PID 1 with the right signal handling.
