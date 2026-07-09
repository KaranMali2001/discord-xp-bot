# 00 — Prompt log

1. Research if a fully-customizable XP bot exists → Yes for most (per-channel, Friday boost, voice presence); the gap no bot fills is *XP for actually speaking* (vs mic-on).
2. Want custom; which language? ecosystem? AI-buildable? hosting? → TS + discord.js (best-supported voice-receive); AI-assisted with you steering (voice is the hard part); Railway → VPS.
3. Explain architecture (FE / API / bot); walk the Friday scenario → one core + two front doors; `voiceStateUpdate` + `speaking.start/end` + 60s XP tick.
4. What do I need? why Postgres? explore Go → Discord dev app + intents; DB = the bot's memory across restarts; Go voice-receive is unsupported ("may break").
5. How to test locally? → bot dials out (no public URL needed); throwaway test server + guild commands (instant); a friend for voice.
6. Minimal setup: WS lib? lightest HTTP framework? SQLite/Drizzle/TS/React → keep discord.js but tune caches; Fastify vs Hono; Drizzle; Vite+React+shadcn; Node not Bun.
7. Does Bun cause problems? → yes — `@discordjs/voice`+opus break on Bun, and single-binary compile fails with native deps. Stay on Node.
8. Create folder + detailed plan referencing my projects; spec-driven prompt history → created discord-xp-bot/PLAN.md; mirrored finance-tracker layering + DispatchX planning habit.
9. Finance tracker ref: Controller/Service/DAO layering, zod before controller, shadcn → adopted layered pattern + shadcn; kept docs short.
10. Fastify vs Hono for WebSockets? RAM/disk numbers? → Fastify (Node+VPS fit); WS rides on `ws` (already pulled by discord.js); ~10–44 MB delta is noise next to discord.js ~100 MB.
11. Auth/user queries in core or api? → identity data in `core/domains/auth`; HTTP enforcement (OAuth/session guard) in `api/middleware`.
12. Session logging + per-session prompt log; start manual + checkpoints → adopted this convention (LOGGING.md).
