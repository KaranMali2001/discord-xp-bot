# 01 — Implementation   (2026-07-07)

**Goal:** build the full monorepo per PLAN, end-to-end and verified.

**Done — all 4 packages implemented & verified:**
- **core** — zod-validated env, Drizzle schema (9 tables), domains rules/xp/leveling/voice/badges/auth (Zod → service → DAO).
- **bot** — discord.js (cache tuned), chat XP, voice presence + **speaking detection** via `@discordjs/voice` receiver, `XP_TICK_SECONDS` loop, level roles + badge announce, 6 slash commands.
- **api** — Fastify, Discord OAuth + dev-login bypass, config/channel-rules/events/level-rewards/badges/admins CRUD + leaderboard + ws.
- **web** — Vite + React + shadcn dashboard, 6 tabs, React Query.
- **Verified:** pnpm install (pnpm 9 needed `onlyBuiltDependencies` to compile better-sqlite3/opus), 4/4 typecheck clean, Biome clean, `db:push` OK, smoke test proved ×2 channel × ×3 event stacking, no-XP skip, speaking-rate XP, Friday attendance, leveling.

**How:** api + web built by parallel background subagents; core + bot by hand (coherence-critical). Fixed 4 real type errors after integration (event `.partial()`, MessageFlags widening, Fastify error typing, web project-refs).

**Next:** real `.env` + live Discord test (a friend for the voice/speaking path); then Docker → Railway; swap SQLite → Postgres when the dashboard goes multi-user.
