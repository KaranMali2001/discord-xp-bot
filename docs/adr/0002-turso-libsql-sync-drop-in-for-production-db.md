# Turso (libsql) as the production database via the synchronous libsql drop-in

## Status

accepted (deployed 2026-07-15)

## Context & Decision

Production ran on a local SQLite file on a Docker named volume — fine for a single box,
but not productizable (no managed backups, no replication, tied to one host). We moved
the production database to **Turso** (managed libsql).

The whole codebase is **synchronous**: `better-sqlite3` + `drizzle-orm/better-sqlite3`,
and every DAO uses sync `.all()` / `.run()` / `.get()`. Drizzle's *official* Turso path
is `@libsql/client` + `drizzle-orm/libsql`, which is **async** — adopting it would mean
rewriting every DAO, service, and caller (event handlers, voice tick, slash commands,
API controllers) to `async/await`.

We decided instead to use the **`libsql` npm package** — a better-sqlite3-**compatible,
synchronous** drop-in — passed to the existing `drizzle-orm/better-sqlite3` adapter. It
talks to remote Turso over a synchronous API, so **no async refactor is needed**. This
was verified end-to-end against the real Turso DB before shipping (raw sync query,
drizzle read, and `db:migrate` all succeeded).

`packages/core/src/db/client.ts` picks the connection by URL scheme:

- `DATABASE_URL=file:./dev.db` → local file (dev), WAL + FK pragmas.
- `DATABASE_URL=libsql://….turso.io` → remote Turso (prod), using `DATABASE_AUTH_TOKEN`.

## Considered options

- **Async `@libsql/client` + `drizzle-orm/libsql`:** rejected — a full async rewrite of
  the entire sync DAO/service/caller layer for no functional gain at current scale.
- **Turso embedded replica** (local file that syncs to Turso): rejected — keeps the sync
  API but reintroduces a synced volume + periodic `.sync()`; unnecessary once direct
  remote sync was proven to work.
- **Stay on the SQLite volume:** rejected — not productizable (no managed backups /
  replication; single-box coupling).

## Consequences

- Runtime uses the sync `libsql` package; **`@libsql/client` is a dev dependency** used
  only by drizzle-kit for migrations (`turso` dialect, selected in `drizzle.config.ts`
  when the URL is remote).
- The native `libsql` client needs **system root CA certificates** for TLS to Turso — the
  Dockerfile `base` stage installs `ca-certificates`, or api/bot crash at boot with
  `InvalidTlsConfiguration`. (Found live during deploy; fixed in PR #8.)
- Migrations run via `pnpm db:migrate` with `DATABASE_URL` + `DATABASE_AUTH_TOKEN` set.
- **Dev is unchanged** — a `file:` URL still uses a local SQLite file.
- Reads/writes are now network round-trips (per-query latency) instead of local file
  access — acceptable at current scale; revisit with caching or an embedded replica if a
  hot path needs it.
- Secrets (`DATABASE_AUTH_TOKEN`) live in `.env` / the gitignored `secrets.json`, never
  committed. The old `discord-xp-bot_db` sqlite volume was removed after cutover.
