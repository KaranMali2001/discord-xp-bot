# Discord XP Bot — Plan

Customizable XP/level/badge bot for our Discord. Per-channel XP, Friday-boost, voice
presence + **actual speaking** XP, chat = lowest. Config editable at runtime (no redeploy).

## Stack (decided)
- **Lang:** TypeScript on **Node** (not Bun — `@discordjs/voice` + opus break under Bun).
- **Discord:** `discord.js` + `@discordjs/voice` (only well-supported voice-receive path).
- **API:** Fastify (Node-native, mature ecosystem; RAM delta vs Hono is noise on a VPS). **ORM:** Drizzle. **DB:** SQLite → Postgres later.
- **Web:** Vite + React + **shadcn/ui** (new-york) + React Query.
- **Pkg mgr:** pnpm workspace. **Lint/format:** Biome. **Validation:** Zod.

## Architecture — one core, two front doors
Discord events **and** dashboard HTTP both call the same domain services.
Layering (per finance-tracker): **Zod → Controller → Service (business) → DAO → DB.**
- Zod validates at the edge (Hono middleware / bot command parse) *before* the controller.
- Services hold business logic; DAOs wrap Drizzle queries; controllers are thin adapters.
- Bot event handlers skip the "controller" and call services directly.

## Repo layout (pnpm workspace)
```
discord-xp-bot/
├── planning/            # short spec docs (below)
├── packages/
│   ├── core/            # shared brains — no transport
│   │   ├── db/          # drizzle schema, client, migrations
│   │   ├── env.ts       # zod-validated env (NEW: we didn't have this before)
│   │   └── domains/     # one folder per domain
│   │       ├── xp/      # xp.service.ts  xp.dao.ts  xp.schema.ts
│   │       ├── leveling/
│   │       ├── voice/
│   │       ├── rules/   # per-channel rates, multipliers, Friday boost
│   │       ├── badges/
│   │       └── auth/    # user/role queries + isAdmin service (data only — shared by bot & api)
│   ├── bot/             # discord.js; events/ → core services; voice receiver
│   ├── api/             # fastify; routes/ → controllers/ → core services
│   │                    #   middleware/auth: session/OAuth guard (HTTP-only) → calls core auth service
│   └── web/             # vite + react + shadcn dashboard
├── .env.sample          # committed, redacted
├── AGENTS.md            # conventions for AI codegen
├── pnpm-workspace.yaml
├── tsconfig.base.json
└── biome.json
```
Domain module = `*.schema.ts` (zod+types) · `*.service.ts` (logic) · `*.dao.ts` (drizzle).
Controllers live in `api/controllers/`; they validate with the domain zod schema, then call the service.

## Env (`.env.sample`, SCREAMING_SNAKE, prefixed, zod-validated in core/env.ts)
```
DISCORD_TOKEN=            # bot token
DISCORD_CLIENT_ID=        # app id (slash-command registration + OAuth)
DISCORD_CLIENT_SECRET=    # dashboard "Login with Discord" OAuth
DISCORD_GUILD_ID=         # test server id (guild commands = instant)
SESSION_SECRET=           # signs dashboard session cookies
DATABASE_URL=file:./dev.db
API_PORT=8080
WEB_URL=http://localhost:5173
XP_TICK_SECONDS=60        # set to 2 locally to see awards fast
```
`.env` (real, gitignored) for dev. Node loads via dotenv; `core/env.ts` parses+validates on boot.

## Planning docs (in planning/ — SHORT, our DispatchX habit)
**Living** (current truth, updated in place):
- `OVERVIEW.md` — problem, scope, out-of-scope.
- `TECH-STACK.md` — decisions, one line each + rejected option.
- `DECISIONS.md` — running log: date · choice · why · revisit-if.
- `specs/*.md` — one short spec per domain before building it.

**History** (append-only, per session — so code is regenerable & *why* is recoverable):
- `sessions/INDEX.md` — one line per session (the spine).
- `sessions/NN-topic/session.md` — goal · done · next.
- `sessions/NN-topic/prompts.md` — every prompt → 1-line response.
- `LOGGING.md` — how/when to log. Manual for now: user says **"checkpoint"** → agent runs it.

## Build order
1. Scaffold workspace + core/db + env + Biome/tsconfig.
2. **Text XP end-to-end** (message → rules → xp → level-up → role) on SQLite. Slash: `/setxp`, `/rank`.
3. **Voice**: presence XP (join/mute via `voiceStateUpdate`) then speaking XP (bot joins, `speaking.start/end`), 60s tick.
4. **Rules/multipliers**: per-channel, Friday boost, timed events.
5. **Badges** + level roles.
6. **Dashboard** (Hono API + React/shadcn) — read/write the same rules.
7. Dockerize → Railway, then Hetzner VPS. Swap SQLite→Postgres (Drizzle: trivial).

## Open questions (before coding)
- Speaking XP granularity: "spoke at all this minute → award minute" (light) — confirm.
- Dashboard now or after voice works? (Recommend: after.)
- Badge triggers: level-only, or also events (attended N Fridays)?
