# 02 — Announcements + Turso + production deploy   (2026-07-15)

**Goal:** ship an announcements feature (slash + dashboard), then productize the DB on
Turso and redeploy the VPS.

## Done

**Announcements feature (PR #6)**
- **core** — shared `announcements` domain: `announcementsService.send()` builds a message
  with member/role mentions and posts it with **explicit allowed-mentions** (only picked
  users/roles ping; a stray `@everyone` in the body stays inert).
- **Scheduled (one-off) announcements** — `scheduled_announcements` table + DAO + service;
  bot scheduler tick (30s) posts due rows; **skip-missed** sweep at startup marks anything
  that came due while offline as missed (never posted late). IST times.
- **bot** — `/announce` slash command: channel + optional `time` (IST `YYYY-MM-DD HH:MM`) →
  user/role select menus → modal for the body → post now or schedule. New component/modal
  routing in `interaction-create`.
- **api** — `POST /announcements` + `GET/POST/DELETE /scheduled-announcements`, manage-guild
  gated.
- **web** — Announcements tab: compose (channel + member/role pickers as chips + `@everyone`
  toggle + live preview), "schedule for later" (IST datetime), and an Upcoming table w/ cancel.

**DB migrations re-baselined**
- Migrations had drifted under a `db:push` workflow (empty journal, stale `0000` snapshot).
  Rebuilt a single complete baseline from `schema.ts` and applied via `db:migrate`, so
  `db:generate` + `db:migrate` works cleanly going forward. README documents the flow.

**Turso (libsql) as production DB (PR #7, ADR 0002)**
- Swapped the driver to the **sync `libsql` drop-in** — no async refactor; the existing
  sync DAO layer works against remote Turso. `client.ts` branches on URL scheme (file: dev,
  libsql:// prod + `DATABASE_AUTH_TOKEN`). `drizzle.config` uses the `turso` dialect for
  remote URLs; `@libsql/client` added as a dev dep for drizzle-kit.
- **Verified against the real Turso DB** before shipping: raw sync query, drizzle read, and
  `db:migrate` (all 11 tables created on an empty Turso DB).

**Production deploy (VPS root@72.61.239.32)**
- Updated the VPS `.env`: Turso `DATABASE_URL` + `DATABASE_AUTH_TOKEN` (from `secrets.json`),
  `TRANSCRIPTS_ENABLED=true`, `AUTH_DISABLED=true` (kept). rsync'd `main`, `docker compose up
  -d --build --force-recreate`.
- **Bug hit live (PR #8):** api/bot crash-looped with `InvalidTlsConfiguration ("no valid
  native root CA certificates found")` — the native `libsql` client needs system root CAs for
  TLS to Turso, and `node:22-bookworm-slim` ships without them. Fixed by installing
  `ca-certificates` in the Dockerfile `base` stage.
- Rebuilt → **all containers healthy on Turso** (restart count 0; bot logged in, 8 global
  commands incl. `/announce`; API DB-backed endpoint returned 200). Removed the old
  `discord-xp-bot_db` sqlite volume.

## Explored, not yet decided

- **Transcription** — capture (Part 1) works and is now **on in prod**, but the **Whisper
  worker (Part 2) still doesn't exist**, so WAVs + `transcript_jobs` just accumulate on the
  `audio` volume. Transcribe later.
- **Auth** — the backend already has Discord OAuth + the exact permission model wanted
  (default from server MANAGE_GUILD, overridable by the DB `admins` allowlist); it's just
  off via `AUTH_DISABLED`. Enabling needs env config + a small FE login gate. Discord OAuth
  **does** work over plain HTTP/IP (not just localhost) but is insecure (cleartext session +
  code); a domain + HTTPS is the recommended prerequisite for "real" auth.

## How
- Workflow: local changes → PR → merge → deploy. Single multiplexed SSH connection to the VPS.
- All work verified: typecheck + Biome clean throughout; Turso + deploy verified live.

## Next
- Build the Whisper worker (Part 2) so recordings actually transcribe.
- Decide auth transport (HTTP now vs domain+HTTPS) and add the FE login gate to enable auth.
