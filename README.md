# Discord XP Bot

Customizable XP / levels / badges bot for our Discord — per-channel XP, Friday boosts,
voice **presence + actual-speaking** XP, chat as the lowest tier. Config is editable at
runtime (slash commands or dashboard), no redeploy.

See [PLAN.md](./PLAN.md) for the full design and [planning/](./planning/) for the decision
history and session logs.

## Stack
TypeScript · Node 20+ · discord.js + @discordjs/voice · Fastify · Drizzle · SQLite→Postgres ·
Vite + React + shadcn/ui · pnpm workspace · Biome.

## Layout
```
packages/
  core/   # env + db + domains (rules · xp · leveling · voice · badges · auth). No transport.
  bot/    # discord.js gateway: chat XP, voice tick, speaking detection, slash commands
  api/    # Fastify: Discord OAuth + config CRUD + leaderboard (+ ws)
  web/    # React dashboard
  landing/ # Astro marketing site (Tech Talks landing page)
```
One core, two front doors: the bot (Discord events) and the API (dashboard) both call the
same core services. Layering: **Zod → controller → service → DAO → DB**.

## Quick start (local)
```bash
pnpm install
cp .env.sample .env          # fill DISCORD_TOKEN, DISCORD_CLIENT_ID, DISCORD_GUILD_ID
pnpm db:migrate              # create the SQLite schema (dev.db) from migrations

# leave DISCORD_CLIENT_SECRET blank locally to use the dashboard dev-login bypass
# set XP_TICK_SECONDS=2 locally so voice XP lands fast

pnpm dev:bot                 # start the bot (auto-deploys guild slash commands)
pnpm dev:api                 # start the dashboard API on :8080
pnpm dev:web                 # start the dashboard on :5173
pnpm dev:landing             # start the landing site on :4321
```

### Changing the database schema
Migrations are the source of truth (`packages/core/drizzle`). After editing
`packages/core/src/db/schema.ts`:
```bash
pnpm db:generate             # write a new migration from the schema diff
pnpm db:migrate              # apply pending migrations (records them in the journal)
```
Commit the generated `drizzle/*.sql` + `meta/` files. `db:push` (schema diff without a
migration file) is fine for throwaway experiments, but don't use it on a DB with real data.

### Discord setup
1. Create an application + bot at <https://discord.com/developers>.
2. Enable **Server Members** and **Message Content** privileged intents.
3. Invite with scopes `bot applications.commands` and perms: Manage Roles, Connect, Speak, Send Messages.
4. Put the token / client id / a test **guild id** in `.env`.

## Slash commands
`/rank` · `/leaderboard` · `/badges` — everyone.
`/setmessagexp` · `/setchannel` · `/friday` · `/announce` — Manage Server. (The dashboard covers full config.)
`/announce` posts or schedules an announcement (member + role mentions); add a `time` (IST) to schedule.

## How XP works
- **Chat** — `messageCreate` → base XP × channel × active events, with a per-user cooldown.
- **Voice presence** — being in a voice channel (unmuted, if `ignoreMutedVoice`) bills at the
  presence rate per minute.
- **Voice speaking** — during an **active event** on a channel, the bot joins it, listens for
  `speaking` events, and bills any minute you actually transmit audio at the higher speaking rate.
- **Multipliers stack**: `base × channelMultiplier × Π(active event multipliers)`.
- A tick loop (`XP_TICK_SECONDS`) does the voice accounting; level-ups grant roles + announce;
  badges are evaluated after every grant.

### Voice-join policy (deliberate)
The bot only enters a voice channel **while an event that applies to it is active** (e.g. your
Friday boost window), then leaves — so it never lurks in casual voice. Consequence: the higher
*speaking* rate only applies during events; outside them, voice earns the presence rate (tracked
via `voiceStateUpdate`, no connection needed). With one connection per guild, if several channels
have an active event at once the bot picks the one with the most people.

## Deploy
Dockerize → Railway (fast) or a Hetzner VPS (cheap, best for native voice deps). Swap
`DATABASE_URL` to Postgres and change the Drizzle dialect when you outgrow SQLite.
