# Decisions

Running log of choices worth remembering. `date · choice · why · revisit-if`.

- **2026-07-07 · Build custom, not off-the-shelf** · no bot awards XP for *actually speaking* (vs mic-on) · revisit if a bot ships true speaking-time XP.
- **2026-07-07 · TypeScript + Node (not Bun, not Go)** · discord.js has first-class voice-receive; Bun breaks `@discordjs/voice`+opus; Go's voice-receive is unsupported · revisit if Bun fixes voice or a supported Go path appears.
- **2026-07-07 · Fastify (not Hono)** · Node+VPS, no edge — Fastify's maturity is upside, Hono's portability wasted; RAM delta is noise next to discord.js · revisit if we ever go edge/serverless.
- **2026-07-07 · Layered: Zod → controller → service → DAO → DB** · mirrors finance-tracker-v2; one core, two front doors (bot events + API) · —
- **2026-07-07 · SQLite (Drizzle) first, Postgres later** · zero-infra dev; Drizzle dialect swap is trivial · revisit when the dashboard needs multi-process/multi-guild scale.
- **2026-07-07 · Speaking XP granularity = "spoke this minute → bill the minute"** · light on CPU/audio; no per-second decode · revisit if we want finer talk-time accounting.
- **2026-07-07 · Auth: identity data in core, HTTP enforcement in api** · bot needs "isAdmin" too; only the web needs sessions/OAuth · —
- **2026-07-07 · pnpm `onlyBuiltDependencies`** · pnpm 9 blocks native build scripts by default — must allowlist better-sqlite3/opus/esbuild · revisit on pnpm upgrades.
- **2026-07-07 · Bot joins voice only during active events** · auto-joining every channel is intrusive and pointless (1 connection/guild); joining only during events keeps it out of casual voice · consequence: speaking bonus only during events; revisit if we want always-on speaking on flagged channels.
