# syntax=docker/dockerfile:1

######## base: Node + pnpm (baked in via corepack, no runtime download) ########
FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm PATH="/pnpm:$PATH"
# ca-certificates: the native `libsql` client needs system root CAs for TLS to Turso.
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates \
 && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /app

######## toolchain: native build deps (libsql / better-sqlite3 / @discordjs/opus compile here) ########
# Lives only in intermediate stages — never copied into a runtime image.
FROM base AS toolchain
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ ca-certificates \
 && rm -rf /var/lib/apt/lists/*
# Copy only manifests first so install layers cache until deps actually change.
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/core/package.json ./packages/core/
COPY packages/api/package.json  ./packages/api/
COPY packages/bot/package.json  ./packages/bot/
COPY packages/web/package.json  ./packages/web/

######## deps-full: every workspace dep — used only to build the web bundle ########
FROM toolchain AS deps-full
RUN pnpm install --frozen-lockfile

######## build-web: produce the static web bundle ########
FROM deps-full AS build-web
COPY . .
# Vite inlines these at build time — point the browser at the API's public URL.
ARG VITE_API_URL=http://localhost:8090
ARG VITE_DEFAULT_GUILD_ID=
ENV VITE_API_URL=${VITE_API_URL} VITE_DEFAULT_GUILD_ID=${VITE_DEFAULT_GUILD_ID}
RUN pnpm --filter @xp/web build

######## deps-server: PROD-only deps for api + bot + core ########
# No web frontend, no typescript/biome, no drizzle-kit. tsx is a prod dep so the
# services can run TS directly. Native modules are compiled here (toolchain present).
FROM toolchain AS deps-server
RUN pnpm install --frozen-lockfile --prod \
      --filter @xp/api --filter @xp/bot --filter @xp/core

######## deps-migrate: core only, incl. dev deps so drizzle-kit is available ########
FROM toolchain AS deps-migrate
RUN pnpm install --frozen-lockfile --filter @xp/core

######## server: shared runtime for api + bot (tsx, no compilers, no frontend) ########
FROM base AS server
ENV NODE_ENV=production
# Pruned, pre-built node_modules first (stable layer)…
COPY --from=deps-server /app/ ./
# …then the source. node_modules is excluded by .dockerignore, so this never
# clobbers the compiled native modules above.
COPY . .
EXPOSE 8090
# The actual command (api / bot) is set per-service in docker-compose.

######## migrate: one-shot schema migrate (needs drizzle-kit) ########
FROM base AS migrate
ENV NODE_ENV=production
COPY --from=deps-migrate /app/ ./
COPY . .
# Command (pnpm --filter @xp/core db:migrate) is set in docker-compose.

######## web: static bundle served by nginx ########
FROM nginx:alpine AS web
COPY --from=build-web /app/packages/web/dist /usr/share/nginx/html
EXPOSE 80
