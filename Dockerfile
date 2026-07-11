# syntax=docker/dockerfile:1

######## base: Node + pnpm (via corepack) ########
FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm PATH="/pnpm:$PATH"
RUN corepack enable
WORKDIR /app

######## deps: install workspace deps with the native toolchain ########
# better-sqlite3 / @discordjs/opus compile here; kept out of the runtime image.
FROM base AS deps
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ ca-certificates \
 && rm -rf /var/lib/apt/lists/*
# Copy only manifests first so this layer is cached until deps actually change.
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/core/package.json ./packages/core/
COPY packages/api/package.json  ./packages/api/
COPY packages/bot/package.json  ./packages/bot/
COPY packages/web/package.json  ./packages/web/
RUN pnpm install --frozen-lockfile

######## build: bring in source, produce the web bundle ########
FROM deps AS build
COPY . .
# Vite inlines these at build time — point the browser at the API's public URL.
ARG VITE_API_URL=http://localhost:8090
ARG VITE_DEFAULT_GUILD_ID=
ENV VITE_API_URL=${VITE_API_URL} VITE_DEFAULT_GUILD_ID=${VITE_DEFAULT_GUILD_ID}
RUN pnpm --filter @xp/web build

######## server: shared runtime for api + bot (tsx, no compilers) ########
FROM base AS server
ENV NODE_ENV=production
# Copy the fully-installed workspace (incl. compiled native modules + tsx).
COPY --from=build /app /app
EXPOSE 8090
# The actual command (api / bot / migrate) is set per-service in docker-compose.

######## web: static bundle served by nginx ########
FROM nginx:alpine AS web
COPY --from=build /app/packages/web/dist /usr/share/nginx/html
EXPOSE 80
