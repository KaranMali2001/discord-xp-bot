# 00 — Planning & stack decisions   (2026-07-07)

**Goal:** decide if a custom bot is needed, pick the stack, define repo structure & logging.

**Done:**
- Confirmed no off-the-shelf bot does "XP for *actually speaking*" → build custom.
- Stack: TS + Node + discord.js/@discordjs/voice + Fastify + Drizzle + SQLite→PG + Vite/React/shadcn.
- Rejected: Bun (voice native deps break), Go (unsupported voice-receive), Hono (edge advantage wasted on VPS).
- Architecture: one core, two front doors; Zod→Controller→Service→DAO→DB; auth data in core, enforcement in api.
- Adopted session-logging convention (living docs + append-only session/prompt logs).

**Next:** answer 3 open questions (speaking granularity, dashboard timing, badge triggers) → scaffold workspace + core/db + env → text-XP end-to-end.
