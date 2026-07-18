# Migration Plan: Turso (sync libsql) → Neon Postgres (async)

**Branch:** `feat/postgres-migration`
**Status:** planned — not started
**Supersedes:** [ADR 0002 — Turso libsql sync drop-in](./adr/0002-turso-libsql-sync-drop-in-for-production-db.md)
**Author context:** written 2026-07-18, after a prod incident where the bot crash-looped 130× on an unrecoverable Turso Hrana `stream not found` error.

---

## 1. Why we're doing this

Two independent motivations:

1. **We want an async data layer + real analytics.** The dashboard is growing and we want
   proper analytical queries, joins, and transactions. Postgres is the right long-term home.
2. **The sync libsql drop-in has a fatal failure mode.** The `libsql` sync driver holds one
   persistent Hrana stream to remote Turso. When that stream expires on idle, the next query
   throws `Hrana(Api("status=404 … stream not found"))` and the connection is **permanently
   wedged** — it cannot recover without a process restart. Because that throw happens inside
   bare `setInterval` callbacks in [`packages/bot/src/voice/tick.ts`](../packages/bot/src/voice/tick.ts)
   (`getConfig()` at lines 21 and 96), it becomes an uncaught exception and kills the process.
   Docker restarts it, the stream expires again, repeat → **130 restarts, 86 during a single
   event**, fragmenting recordings into 85 one-minute session folders.

> **Root-cause note:** motivation #2 is *aggravated* by libsql but is fundamentally a
> **missing-error-handling bug**. ANY database (Postgres included) can throw transiently. If
> the throw lands in a bare timer, the process still dies. **The error-containment work
> (Phase 0) is mandatory regardless of the DB and is the durable fix.** Neon only reduces how
> *often* errors occur.

## 2. Decisions locked

| Decision | Choice | Rationale |
|---|---|---|
| Vendor | **Neon Postgres** (ap-south region) | Free tier, analytics-friendly, already anticipated (`// Drop on Neon move` in schema). |
| Driver | **`pg` (node-postgres) `Pool`** + **`drizzle-orm/node-postgres`** | We're a long-lived VPS process, not edge. TCP pool = full transaction support (needed for analytics) and **auto-reconnect** (evicts dead clients, opens fresh ones — no permanent wedge like libsql). |
| Connection string | Neon **pooled** (pgBouncer) endpoint for the app; **direct** endpoint for drizzle-kit migrations | Pooled masks cold starts; migrations need a direct session. |
| Data | **Migrate all of it** | Members keep XP/levels/badges/attendance; the ~1977 pending `transcript_jobs` come along too. |
| Async | **Full async conversion** of the DAO/service/caller layers | Postgres drizzle is async-only; this is the point of the migration. |
| Ticket-attachment images | **Cloudinary** (off-DB object storage) | Keeps raw image bytes out of Neon's ~0.5 GB storage tier; CDN delivery + on-the-fly transforms. Postgres stores only a `public_id`/URL reference. **Full design in §2.2.** |

### Why NOT the alternatives (for the record)
- **`neon-http` (stateless HTTP):** zero idle-failure surface, but no interactive/multi-statement
  transactions — worse fit for analytics. Kept as a fallback if pooling ever misbehaves.
- **Scale-to-zero is a COST risk, not a non-issue (corrected).** The reconcile loop
  ([`tick.ts:91`](../packages/bot/src/voice/tick.ts), every 5s) iterates **every guild
  unconditionally** and calls `rulesService.getConfig()` ([`tick.ts:21`](../packages/bot/src/voice/tick.ts))
  + `rulesDao.listEvents()` ([`tick.ts:23`](../packages/bot/src/voice/tick.ts)) **even when nobody is
  in voice**. That pins Neon compute on ~24/7 ≈ **~182 CU-hours/month at 0.25 CU** — at/over Neon's
  free-tier cap (~192 CU-hours/month) *before* the API/dashboard are counted. Once exhausted, Neon
  **suspends** the compute → hard outage, not slow cold starts.
  - **Mitigation (do this): memoize `getConfig`/`listEvents` in an in-memory bot cache, invalidated on
    write.** They change rarely; caching lets the idle reconcile loop touch **zero** DB, so Neon scales
    to zero during quiet hours and the free tier is safe. Also slashes DB load. The bill loop
    ([`tick.ts:93`](../packages/bot/src/voice/tick.ts)) only queries active sessions — already idle-safe.
    **Full design in §2.1 below.**
  - If we choose not to cache, budget for Neon's paid **Launch** plan — free tier is not viable with
    an always-on reconcile loop. `pg.Pool` self-heals regardless of idle timer.

## 2.1 Config/events cache (the scale-to-zero enabler)

The bot keeps config + events in an **in-memory read cache**, loaded once at boot, and reads it forever;
it hits the DB again only when *told* the data changed. When idle it issues **zero** queries → Neon
idles. Postgres stays the single source of truth; the bot holds a read-through cache; the **API (the
writer) must signal the bot (the reader)** on every change. See the diagrams in
[architecture.md §8](./architecture.md).

**Cross-process invalidation — chosen mechanism: API → bot HTTP webhook.**

| Option | Verdict |
|---|---|
| **API → bot HTTP webhook** (`POST /cache/invalidate {guildId, what}`) | ✅ **Chosen.** No new infra, self-heals on boot reload. **⚠️ the bot runs `network_mode: host`** (docker-compose.yml) — it is NOT isolated on the compose bridge, so the endpoint binds on the host. **Bind it to loopback (`127.0.0.1`) and require a shared secret** so it isn't reachable from off-host. |
| Redis pub/sub | Only if Redis is already present for another reason — not worth a new always-on service on a 1-CPU/no-swap box. |
| Postgres `LISTEN/NOTIFY` | ❌ Needs the **direct** (non-pooled) endpoint (pgBouncer drops it) **and** an always-on connection that defeats scale-to-zero. |

- **Invalidation = rebuild from DB, not payload-carried.** The webhook says only "guild X changed";
  the bot **refetches that guild's config/events from Postgres** and swaps the cache entry. A bad or
  partial payload can never corrupt the cache. (Full-array rebuild is also fine — the dataset is tiny.)
- **Backstop:** a **30-min low-frequency reload** of config/events catches any webhook lost while the
  bot was restarting. ~48 tiny queries/day is negligible for cost and guarantees eventual consistency.
  Net posture: **push for freshness, slow pull as insurance.**
- **Speaking / bill writes stay as-is — no Redis buffer.** Speaking is already debounced to an
  in-memory boolean ([`tick.ts:101`](../packages/bot/src/voice/tick.ts)) — the audio stream never hits
  the DB. Bill writes (attendance + XP, every 60s) happen **only while people are in voice = when Neon
  is already awake**, at trivial volume. A Redis write-buffer buys little: a bot crash already loses
  live session state (in memory), so in-memory batching is no more fragile. **Decision: keep bill
  writes direct-to-Postgres; revisit in-memory batched flush only if measured write pressure appears.**

**Implementation items (fold into Phase 3):**
- [ ] Bot: load all config + events into memory at boot; reconcile/bill read from cache only.
- [ ] Bot: minimal internal HTTP listener `POST /cache/invalidate {guildId, what}` → refetch + swap.
- [ ] API: after every config/event write, call the bot's invalidate endpoint (fire-and-forget, log on failure — the backstop covers a miss).
- [ ] Bot: 30-min backstop reload of config + events.
- [ ] Verify: with nobody in voice, the bot issues **zero** DB queries for ≥10 min (Neon idles).

## 2.2 Ticket-attachment image storage — Cloudinary (replaces `bytea`-in-Postgres)

Exactly **one** column holds raw bytes: `ticket_attachments.data` (`blob` today → would become `bytea` on Neon).
Storing image bytes in Postgres is the single biggest threat to Neon's ~0.5 GB free-tier storage cap, and it
bloats every `pg_dump`/backup. **Decision: move ticket-attachment images out of the DB into Cloudinary; Postgres
keeps only a reference (public_id + URL + metadata).**

Current flow: the bot downloads each Discord attachment's bytes ([`tickets.ts`](../packages/bot/src/features/tickets.ts),
setting `sizeBytes = data.byteLength`) and writes them into `ticket_attachments.data`. New flow: the bot uploads
those bytes to Cloudinary (server-side, signed) and stores the returned `public_id`/`secure_url` instead; the
dashboard renders a Cloudinary URL rather than streaming bytes back through the API.

**Decisions:**

| Question | Choice | Why |
|---|---|---|
| Where the bytes live | **Cloudinary**, not `bytea` | Reference row is ~100 bytes vs KB–MB of image; off-DB CDN delivery + derived thumbnails. **Removes the only `bytea` column**, so the Phase-2 blob storage risk disappears from the *target* schema. |
| Who uploads | **Bot only, server-side signed** | The bot already fetches the bytes from Discord and holds the API secret — it calls `cloudinary.uploader.upload`. No browser/client-side signing needed. |
| Delivery / privacy | **Upload `type: 'authenticated'` + signed delivery URLs** | Attachments come from **private** support threads and may hold sensitive info — public, guessable CDN URLs are wrong. The API mints short-lived signed URLs for the dashboard. *(Open: confirm authenticated vs. plain `upload` — see revision history.)* |
| Config location | **`@xp/core`** (shared), like the DB client | Bot uploads + deletes; API signs delivery URLs. Same "shared logic in core" convention. |
| Lifecycle | **Delete on ticket/attachment purge** | Call `cloudinary.uploader.destroy(public_id)` when a ticket is removed so freed storage is reclaimed — the fixed Free plan **suspends** on overage, so don't leak orphaned assets. |
| Failure mode | **Upload failure is non-fatal to the ticket** | If Cloudinary is unreachable, log + keep the ticket and retry/backfill later — never throw out of the handler (same Phase-0 containment rule). |

**Free-tier guardrail:** Cloudinary Free = **25 credits/mo**, where **1 credit = 1 GB stored *or* 1 GB delivered
bandwidth** (bandwidth/transforms metered on a rolling 30-day window). Overage on the fixed Free plan **blocks
uploads / suspends the account** rather than billing — the same "hard outage, not slow degradation" failure shape
as the Neon tier. Mitigate by: (a) `destroy()` on ticket purge, (b) validating/capping upload size, (c) storing the
original plus a small number of named derived sizes rather than unbounded per-request transforms.

**⚠️ Missing credential:** `secrets.json` now carries the Cloudinary **cloud name** (`dzpaxmdlg`) and **API secret**,
but the **API key** (~15-digit number, from the Cloudinary console) is still blank — server-side signed uploads
cannot run without it. Fill `cloudinary.apiKey` before Phase 3.

**Implementation items (fold into the phases):**
- [ ] **Phase 2:** swap `data: blob(...)` on `ticket_attachments` for `cloudinaryPublicId: text` + `url: text`; keep `contentType`, `sizeBytes`, `filename`. This retires the last `bytea` column.
- [ ] **Phase 1/5:** add `CLOUDINARY_URL` (`cloudinary://<api_key>:<api_secret>@<cloud_name>`) **or** the trio `CLOUDINARY_CLOUD_NAME`/`CLOUDINARY_API_KEY`/`CLOUDINARY_API_SECRET`; validate in [`env.ts`](../packages/core/src/env.ts) (required when ticket image capture is enabled). Local values in `secrets.json` under `cloudinary`; prod values in GitHub Actions `PROD_ENV`.
- [ ] **Phase 3:** add the `cloudinary` npm dep to `@xp/core`; add a small `imageStore` wrapper (`upload` / `destroy` / `signedUrl`) configured from env. Bot ticket handler uploads instead of writing `data`; API returns a signed delivery URL.
- [ ] **Phase 4 (backfill):** for existing `ticket_attachments` rows, upload each blob to Cloudinary and record `public_id`/`url`. This is the **one** place the old blob bytes are still read — do it from the local Turso export, not live Turso, and never copy `data` into Neon.
- [ ] **Web:** render `<img>` from the signed URL instead of the current DB-bytes path.

## 2.3 Persistent server-side logs (survive Docker crash / container removal)

**Problem.** Both processes log only to **stdout** today — the bot via its custom logger
([`packages/bot/src/lib/log.ts`](../packages/bot/src/lib/log.ts) → `console.log`) and the API via
Fastify's built-in Pino ([`app.ts`](../packages/api/src/app.ts): `Fastify({ logger: { level } })`).
Docker captures stdout with the default `json-file` driver, but the deploy runs
`docker compose down --remove-orphans` on **every push** ([`deploy.yml`](../.github/workflows/deploy.yml)),
which **deletes those container logs**. So we lose logs on every deploy — and also whenever a container
is recreated or the Docker daemon itself crashes. This is exactly the visibility we needed to debug the
130-restart incident, and it's gone by the time we look.

**Decision: write logs to a file on a HOST bind-mount, outside any container.** Only a host path
survives `--remove-orphans`, container recreation, and a daemon crash. Keep `--remove-orphans` as-is —
the bind-mount is orthogonal to it.

| Option | Verdict |
|---|---|
| Docker `json-file` driver + `max-size`/`max-file` rotation | ❌ Rotates, but lives **inside** the container — `down --remove-orphans` deletes it. Doesn't meet the requirement. |
| Ship to an external log service (Loki/Datadog/…) | ❌ Overkill + a new always-on dependency on a 1-CPU/no-swap box. |
| **App writes to a host bind-mount file** (`./data/logs/{bot,api}.log`) | ✅ **Chosen.** Lives on the VPS filesystem, outside Docker. `./data/` is **already excluded from the deploy's `--delete` rsync** ([`deploy.yml`](../.github/workflows/deploy.yml) — alongside `data/audio`), so no deploy.yml change is needed and it's never wiped. |

**Mechanism: Pino async file destination (SonicBoom) — not a hand-rolled sync sink.**
Pino **v10** and **sonic-boom** are already in the dependency tree (transitively, via Fastify), and the
API already logs through Pino. Standardize both services on Pino's async destination rather than a custom
`appendFileSync`-per-line sink: async buffered writes don't stall the event loop (matters once we add
chatty debug logging), and crash-durability is recovered by an explicit **`flushSync()` in the same
Phase-0 exit/crash handlers** we're adding anyway. The only residual loss is the sub-buffer on a hard
`SIGKILL`/power-cut — an accepted, standard trade (Pino docs call this out explicitly).

> **Dep note:** `pino` is currently only a *transitive* dep (fragile under pnpm's strict `node_modules`).
> Declare `pino` as an **explicit direct dependency** in any package that `import`s it — the **api** (and
> the **bot**, which today uses its own console logger and has no Pino). Pin to match Fastify's Pino (v10).

**Design points:**
- **Bind-mount `./data/logs` into `bot` and `api`** (mirrors the existing `audio` volume convention);
  set `LOG_DIR=/data/logs` for both. Host path `./data/logs/{bot,api}.log` is directly `tail`-able on the VPS.
- **Async destination + keep stdout, via `pino.multistream`.** Build one stream set:
  ```ts
  const fileDest = pino.destination({ dest: `${env.LOG_DIR}/api.log`, sync: false, minLength: 4096, mkdir: true })
  const logger = pino({ level: env.LOG_LEVEL },
    pino.multistream([{ stream: process.stdout }, { stream: fileDest }]))
  ```
  `sync: false` + `minLength` buffers writes off the hot path; stdout stays for `docker compose logs -f`;
  the file is the durable copy. API wires this via `Fastify({ loggerInstance: logger })`.
- **Crash-safe flush in the Phase-0 handlers (the key part).** The most valuable line for debugging a
  Docker crash is the stack trace, which today goes to **stderr and is lost**. Route the Phase-0 global
  `uncaughtException`/`unhandledRejection` handlers through Pino and **flush synchronously** so the reason
  is on disk next boot:
  ```ts
  process.on('uncaughtException', pino.final(logger, (err, final) => { final.error(err, 'uncaughtException'); process.exit(1) }))
  process.on('unhandledRejection', pino.final(logger, (err, final) => { final.error(err, 'unhandledRejection'); process.exit(1) }))
  for (const s of ['SIGINT','SIGTERM']) process.once(s, () => { fileDest.flushSync(); process.exit(0) })
  process.on('exit', () => fileDest.flushSync())
  ```
  `pino.final` writes synchronously during the final tick (async writes wouldn't resolve before the
  process dies). These handlers are being added in Phase 0 regardless — this just flushes on the way out.
- **Bot: adopt Pino for the persistent file, keep human-friendly stdout.** Add `pino` to the bot; its
  [`log.ts`](../packages/bot/src/lib/log.ts) keeps the existing leveled/emoji `console` output for dev
  readability **and** tees each line to a `pino.destination({ dest: '${LOG_DIR}/bot.log', sync:false, minLength:4096 })`.
  Flush it in the same crash/shutdown handlers (reuse the existing `shutdown()` in [`index.ts`](../packages/bot/src/index.ts)).
- **Rotation: system `logrotate`, not in-process.** Because an async destination holds the file **open**,
  rotate with OS `logrotate` using either `copytruncate` **or** `postrotate` → `SIGHUP` → SonicBoom
  `reopen()` (Pino/SonicBoom's built-in rotation hook). This drops the hand-rolled size-rotation code
  entirely and is the idiomatic Pino+logrotate combo.
- **Local dev:** when `LOG_DIR` is unset, skip the file stream and log to stdout only.

**Implementation items (Phase 0 — independent of the DB move; ship with error containment):**
- [ ] Add `LOG_DIR` (optional) to [`env.ts`](../packages/core/src/env.ts); unset → stdout only.
- [ ] Add `pino` as an **explicit** direct dependency to `packages/api` and `packages/bot` (v10, to match Fastify).
- [ ] API [`app.ts`](../packages/api/src/app.ts): build a Pino instance with `multistream([stdout, pino.destination({sync:false,minLength})])`; pass via `Fastify({ loggerInstance })`.
- [ ] Bot [`log.ts`](../packages/bot/src/lib/log.ts): keep console output; tee to a `pino.destination` async file stream; flush it in the [`index.ts`](../packages/bot/src/index.ts) crash/`shutdown` handlers.
- [ ] Both: `pino.final`-wrapped `uncaughtException`/`unhandledRejection` + `flushSync()` on `SIGINT`/`SIGTERM`/`exit` (folds into the Phase-0 global handlers).
- [ ] [`docker-compose.yml`](../docker-compose.yml): bind-mount `./data/logs:/data/logs` + `LOG_DIR=/data/logs` on `bot` and `api`.
- [ ] Add a `logrotate` config on the VPS (size/daily cap + `copytruncate` or SIGHUP→`reopen()`); no in-process rotation.
- [ ] [`.gitignore`](../.gitignore): add `data/logs/` (like `data/audio/`).
- [ ] Verify: after a `docker compose down --remove-orphans` + `up`, prior lines survive in `./data/logs/*.log`; an induced crash leaves its stack trace in `bot.log`; under load the event loop isn't stalled by logging.

## 3. Scope (measured)

- **16 tables** in [`packages/core/src/db/schema.ts`](../packages/core/src/db/schema.ts) (`sqlite-core`) → `pg-core`. (Was mis-stated as 17; verified 16 — the row-count parity assertion depends on this.)
- **~59 sqlite-specific constructs** (int-booleans, epoch-second integers, autoincrement).
- **8 DAO files**, **~61 sync call-sites** (`.get()`≈26 / `.all()`≈16 / `.run()`≈19). **No libsql *terminal* `.values()`** (the raw-tuple reader) exists to convert — note this is *different* from drizzle's insert value-setter `.insert().values({...})`, which is used everywhere and ports to pg-core **unchanged**. **28 downstream files** (not ~35) import `@xp/core` (`web` is types-only). **Zero `db.transaction()` sites** — that risk/mapping row is moot here.
- Touches all three deployables: `bot`, `api`, `web`.
- **Estimate: ~3–4 focused days**, dominated by the async conversion (Phase 3).

---

## 4. Phased plan

### Phase 0 — Error containment (SHIP FIRST, independently)
The one change that stops the crash class forever. Do this before anything else so main is safe
even if the migration stalls.

- [ ] Wrap both `setInterval` bodies in [`tick.ts`](../packages/bot/src/voice/tick.ts) (reconcile + bill) in `try/catch` — log and skip the tick, never throw out.
- [ ] **Guard the other same-class crash paths — tick.ts is NOT the only one:**
  - [`message-create.ts:13`](../packages/bot/src/events/message-create.ts) — `xpService.grantMessage()` hits the same sync DB surface on **every message** (unguarded `async` listener → `unhandledRejection`). Wrap in try/catch.
  - [`scheduled-tick.ts:23`](../packages/bot/src/features/scheduled-tick.ts) — a **third** `setInterval(async …)` the original plan missed. Wrap its body.
  - Model on [`interaction-create.ts`](../packages/bot/src/events/interaction-create.ts), which already try/catches its dispatch correctly.
- [ ] **Global handlers should crash cleanly, NOT log-and-continue.** Add `process.on('uncaughtException', …)` / `process.on('unhandledRejection', …)` in [`index.ts`](../packages/bot/src/index.ts) that **log → best-effort `tracker.disconnectAll()`/`client.destroy()` with a short timeout → `process.exit(1)`**. Rationale: after `uncaughtException` Node is in an undefined state (log-and-continue is officially discouraged), and against libsql's *permanent* stream wedge, swallowing the throw yields a **silent zombie** (bot up, awards no XP, records no attendance) — worse than crashing. A fresh process gets a fresh stream, so **restart IS the recovery**.
- [ ] **Add a Docker restart backoff / crash-loop cap** in [`docker-compose.yml`](../docker-compose.yml). This — not the try/catch — is the real fix for "130 restarts, 86 in one event"; clean crashes still need throttling so a recurring wedge can't fragment recordings. **⚠️ Mechanism caveat:** the current policy is `restart: unless-stopped`, and the Compose `restart:` short-form field (`no|always|on-failure|unless-stopped`) does **not** accept a delay or max-retry count — those live only under `deploy.restart_policy` (`condition/delay/max_attempts/window`), which plain `docker compose up` (non-swarm) largely ignores. So a true backoff/cap needs one of: `deploy.restart_policy` (verify your Compose version actually honors it outside swarm), a container `healthcheck` gate, or an external supervisor — **not** the bare `restart:` field alone.
- [ ] Add a small `withRetry(fn, {retries, backoff})` helper in `@xp/core` for transient DB errors; wrap the hottest read (`rulesService.getConfig`). **Must be bounded AND error-classifying:** do **not** retry the known-permanent libsql `stream not found`/Hrana-404 class (fail fast → crash-restart for a fresh stream). An unbounded/undiscriminating retry masks the wedge as a slow crash or a hung tick.
- [ ] **Verify** on prod (or staging): an induced *transient* error retries+recovers without exiting; an induced *permanent* wedge crashes cleanly (exit 1) and restarts under the backoff — **not** log-and-continue into a zombie.
- [ ] **Persist logs to a host bind-mount so they survive `down --remove-orphans` / a Docker crash** — full design in [§2.3](#23-persistent-server-side-logs-survive-docker-crash--container-removal). Route the global crash handlers above through the file sink so the crash stack trace lands on disk. (Independent of the DB move; ship with the rest of Phase 0.)

> Phase 0 can merge to `main` on its own PR — it's valuable with or without the Postgres move.

### Phase 1 — Provision Neon + wiring
- [ ] Create Neon project (ap-south), a database, and a role.
- [ ] Capture **both** connection strings (pooled + direct).
- [ ] Add to `secrets.json` under a new `neon` key (pooled + direct) — gitignored, same pattern as `turso`. **Note: `secrets.json` is local-only** (rsync-excluded, never reaches the VPS). Production secrets live in **GitHub Actions** (`PROD_ENV` + the runner `migrate` job's DB URL) — those get updated at cutover (Phase 5).
- [ ] Add env vars: keep `DATABASE_URL` (now a `postgres://` pooled URL) and add `DATABASE_DIRECT_URL` (direct, for migrations). Drop `DATABASE_AUTH_TOKEN` once Turso is gone. Also add the `CLOUDINARY_*` vars for image storage (§2.2).
- [ ] Update [`env.ts`](../packages/core/src/env.ts) validation (accept `postgres://`/`postgresql://`; `DATABASE_DIRECT_URL` optional, defaults to `DATABASE_URL`).

### Phase 2 — Schema rewrite (`sqlite-core` → `pg-core`)
Rewrite [`schema.ts`](../packages/core/src/db/schema.ts). Type mapping:

| Current (sqlite-core) | New (pg-core) | Notes |
|---|---|---|
| `text('x')` | `text('x')` | unchanged |
| `integer('x')` (plain counter) | `integer('x')` or `bigint('x', { mode: 'number' })` | XP/seconds counters fit `integer`; use `bigint` if unbounded |
| `integer('x', { mode: 'boolean' })` | `boolean('x')` | e.g. `enabled`, `ignoreMutedVoice`, `countsAttendance` |
| `integer('x')` storing **epoch seconds** (`firstSeenAt`, `startsAt`, `fireAt`, `createdAt`…) | **keep as `bigint('x', { mode: 'number' })`** | Lowest churn: `nowSec()` and all comparisons keep working. (Optional later: migrate to `timestamptz` in a follow-up ADR.) |
| `integer('id').primaryKey({ autoIncrement: true })` | `serial('id').primaryKey()` (or `integer().generatedAlwaysAsIdentity()`) | preserve existing IDs on import (see Phase 4) |
| `primaryKey({ columns: [...] })` | `primaryKey({ columns: [...] })` | composite PKs unchanged |
| `index('name').on(...)` | `index('name').on(...)` | unchanged |
| `blob('data')` (raw bytes — `ticketAttachments.data`) | **removed** → `cloudinaryPublicId text` + `url text` | **Decision (§2.2): do NOT port to `bytea`.** Ticket-attachment images move to Cloudinary; Postgres keeps only the reference. Retires the only blob/`bytea` column and removes the Neon free-tier storage risk from the target schema. |
| `real('x')` | `real('x')` or `doublePrecision('x')` | floating-point columns |
| `sql\`(unixepoch())\`` defaults | `sql\`extract(epoch from now())::bigint\`` or set in app via `.$defaultFn()` | keep epoch-seconds semantics; Postgres has no `unixepoch()` |

- [ ] Rewrite all 16 tables.
- [ ] Update [`drizzle.config.ts`](../packages/core/drizzle.config.ts): `dialect: 'postgresql'`, `dbCredentials.url = DATABASE_DIRECT_URL`.
- [ ] `pnpm --filter @xp/core db:generate` → new baseline migration in `./drizzle`. Archive the old sqlite/turso migrations (don't run them against PG).
- [ ] Delete the now-dead `// Drop on Neon move` deprecated columns (`modChannelId` on `ticket_config` and `modMessageId` on `tickets`) while we're here.

### Phase 3 — Client + async conversion (the big one)
- [ ] Replace [`client.ts`](../packages/core/src/db/client.ts): `drizzle(pool, { schema })` from `drizzle-orm/node-postgres`, with an explicit `pool.on('error', …)` handler. **Pool sizing (bot + api share Neon's connection budget):**
  ```ts
  new Pool({
    connectionString: env.DATABASE_URL,   // pooled (pgBouncer) endpoint
    max: 5,                                // per process; bot(5) + api(5) = 10 total, well under Neon's ceiling
    idleTimeoutMillis: 30_000,             // evict idle clients before Neon's ~5-min server-side timeout
    connectionTimeoutMillis: 10_000,       // fail fast on a wedged connect instead of hanging a tick
    keepAlive: true,                       // TCP keepalive so idle sockets aren't silently dropped
  })
  ```
  - Rationale: two long-lived processes, so `max: 5` each (10 total) leaves headroom on the free tier and is plenty for a 1-CPU box. Bump only if pool-exhaustion timeouts appear under event load. If we ever add more processes, revisit the shared budget.
- [ ] Convert **8 DAOs** to async. pg-core has **no sync terminal methods** — the query builder is a thenable you `await` directly (resolves to `T[]`). Mechanical mapping for the 61 call-sites:

  | sqlite-core (sync) | pg-core (async) | Notes |
  |---|---|---|
  | `.get()` → row \| `undefined` | `const [row] = await q` | destructure `[0]`; still `undefined` if no rows |
  | `.all()` → `T[]` | `const rows = await q` | drop `.all()`, add `await` |
  | `.run()` (side-effect) | `await q` | drop `.run()`, add `await` |
  | `.run()` then re-read | `await q.returning()` | one round-trip; `lastInsertRowid`/`changes` don't exist in pg |
  | `.values()` (raw tuples) | `await q` (object rows), or `db.execute(sql\`…\`)` | **no `.values()`** on pg builders |
  | `db.run(sql\`…\`)` | `await db.execute(sql\`…\`)` | raw exec |
  | `db.transaction((tx) => …)` **sync** | `await db.transaction(async (tx) => …)` | better-sqlite3 callbacks are sync; pg is async — `await` every `tx.*` |

  - `onConflictDoUpdate` ports 1:1 **but Postgres requires an explicit `target`**. Verified: all **7** `onConflictDoUpdate` sites (`rules.dao.ts:21,45,94`; `voice.dao.ts:59`; `tickets.dao.ts:25`; `badges.dao.ts:17`; `xp.dao.ts:29`) **already pass a target** — no work there. The 4 `onConflictDoNothing` sites (`auth.dao.ts:24`, `badges.dao.ts:47`, `voice.dao.ts:34`, `tickets.dao.ts:135`) are legal target-less in PG.
  - **`.changes` IS used** — [`scheduled.dao.ts:132,148`](../packages/core/src/domains/announcements/scheduled.dao.ts) `return res.changes`. pg has no `.changes`; convert to `.returning({ id })` + `.length` (or `rowCount` via `db.execute`). Consumers use the value synchronously, so `tsc` **will** flag these. (No `lastInsertRowid` usage anywhere.)
  - return types become `Promise<…>`.
- [ ] Convert **services** that call DAOs (`rulesService`, `voiceService`, `xpService`, badges, tickets, announcements, transcript, auth) to async.
- [ ] **⚠️ Highest data-loss risk — the fire-and-forget write in the bill loop:** [`tick.ts:108`](../packages/bot/src/voice/tick.ts) `voiceService.recordDuration(...)` is `void`, called **unawaited**, and its return is discarded → after async conversion it's a floating promise that **silently drops attendance duration** and races `s.lastAccountedAt`. **`tsc` will NOT catch this** — the lint gate below is the only net. This is the single most important spot in the conversion. *(Note: `grantTick` at [`tick.ts:120`](../packages/bot/src/voice/tick.ts) also needs `await`, but its result IS consumed synchronously (`if ('result' in outcome …)`), so `tsc` **will** flag it — lower risk.)*
- [ ] Also `await` the unlisted floating call: `sweepMissedAnnouncements()` invoked at [`index.ts:32`](../packages/bot/src/index.ts) (fired in the `ClientReady` handler).
- [ ] Convert **28 downstream callers** (not ~35) to `await`:
  - `packages/bot`: voice `tick.ts` loops, `voiceStateUpdate`/`messageCreate` handlers, slash-command handlers, `rewards.ts`, `scheduled-tick.ts`.
  - `packages/api`: all controllers/route handlers (11 controllers + 12 route files).
  - `packages/web`: **types-only** import (`lib/api.ts`) — no server-side DB access to convert.
- [ ] Strategy: convert **package-by-package, bottom-up** (core → bot/api), using `tsc`/build as the *primary* guardrail. **Caveat:** `tsc` only flags a missing `await` when you *use* the value synchronously — it does **not** catch fire-and-forget side-effect statements (`xpDao.increment(...)`, `.run()`-style writes) that now return an ignored floating `Promise`. Those silently race or drop. A floating-promises lint rule is therefore **load-bearing, not optional** (see below).
- [ ] **Prerequisite — upgrade Biome `^1.9.4` → `≥2.4`.** The repo is currently pinned to Biome **1.9.4** ([`biome.json`](../biome.json), root [`package.json`](../package.json)), where the type-aware `noFloatingPromises`/`noMisusedPromises` rules **do not exist**. This is a **major-version bump** (run `biome migrate` to convert the config format) and is a hard prerequisite for the lint gate below — budget it as its own task, don't fold it into the conversion.
- [ ] **Enable floating-promise linting as a hard CI gate** before merging the conversion:
  - After the 2.x upgrade, enable `noFloatingPromises` and `noMisusedPromises` (stable, type-aware — the `types` domain turns on Biome's scanner/inference; not on by default). `noMisusedPromises` also catches `setInterval(async () => …)` (async fn where a void callback is expected) — directly relevant to [`tick.ts`](../packages/bot/src/voice/tick.ts).
  - Biome's inference is an independent reimplementation (~85% coverage) with **known drizzle-thenable edge cases** (biome#8476). For a migration where one missed `await` is a silent data bug, add a **minimal ESLint config enabling only** `@typescript-eslint/no-floating-promises` + `no-misused-promises` (type-checker-backed, gold standard) as a second net in CI, droppable later once Biome is confirmed solid on our drizzle code.
  - Also enable `useAwait` (`require-await`) as a cheap syntactic net. `noAwaitInLoops` should be **advisory only** — sequential per-row `await` in a loop is often intentionally correct here.
- [ ] **Wire the gate into CI** ([`.github/workflows/ci.yml`](../.github/workflows/ci.yml)): CI today runs only `typecheck` + `biome check`. Keep both, and ensure `biome check` runs the upgraded 2.x config with the floating-promise rules at **error** severity so the conversion can't merge with a dropped `await`. Add a test job once Phase 4's local Postgres DAO tests exist.
- [ ] Re-check the `isEventActive`/`localClock` IST logic is untouched (pure functions — no DB — should be safe).

### Phase 4 — Data migration (Turso → local Postgres → Neon)
One-shot, idempotent, verifiable. **Prove the whole pipeline against a local Postgres first; Neon is just the same script pointed at a different URL.** The migration DDL is identical everywhere — the **same drizzle-kit migrations** run against local and Neon, so schema parity is guaranteed by construction (no hand-applied schema drift).

- [ ] Export Turso once to a portable local artifact (read-only): dump every table to JSON/NDJSON (or a local SQLite file copy) so re-runs don't re-hit Turso.
- [ ] Stand up a **local Docker Postgres** and run the drizzle-kit baseline migration against it (`db:migrate`) — the exact migration that will later run on Neon.
- [ ] Write `packages/core/scripts/migrate-to-postgres.ts` (target URL is a parameter, not hard-coded to Neon):
  - Read every table from the local export — read-only w.r.t. Turso.
  - Bulk `INSERT` **preserving primary keys** for the **7 tables with autoincrement sequences** (`channel_rules`, `multiplier_events`, `level_rewards`, `badges`, `scheduled_announcements`, `tickets`, `ticket_attachments`), then `setval()` each sequence to `max(id)+1`. **`setval` ONLY these 7 — target them by name, not by iterating tables.** The other **9** tables have **no sequence** and a blanket "reset every `id_seq`" loop will error on all of them: the **3 text PKs** (`guild_config.guildId`, `ticket_config.guildId`, `transcript_jobs.id`) **and the 6 composite PKs** (`members` `[guildId,userId]`, `admins` `[guildId,userId]`, `member_badges` `[guildId,userId,badgeKey]`, `event_attendance` `[guildId,userId,eventId,day]`, `event_voice_stats` `[guildId,userId,eventId,day]`, `ticket_participants` `[ticketId,userId]`). (16 tables = 7 sequence + 3 text + 6 composite.)
  - Order parents before children (no DB-level FKs exist, but keep logical order): config/members → `multiplier_events` → `event_attendance`/`event_voice_stats`; `tickets` → `ticket_attachments`/`ticket_participants`.
  - Coerce types: sqlite `0/1` → PG `boolean` for **all 6** boolean columns (`guildConfig.ignoreMutedVoice`, `channelRules.noXp`, `multiplierEvents.enabled`, `multiplierEvents.countsAttendance`, `scheduledAnnouncements.mentionEveryone`, `ticketConfig.enabled`); epoch ints pass through as `bigint`; **blob bytes are NOT copied into Neon** — each is uploaded to Cloudinary and the row stores `public_id`/`url` instead (§2.2 backfill).
  - **Measure blob size first** from the **actual bytes**, not the denormalized column: `SELECT count(*), sum(length(data)), max(length(data)) FROM ticket_attachments` (`size_bytes` defaults to 0 and is only set on the bot download path, so a `sum(size_bytes)` undercounts). Use it to size the **Cloudinary backfill** against the 25 GB free-tier storage credit (no longer against Neon) and fail loud if it's close.
  - **Skip the deprecated dropped columns** — `ticket_config.modChannelId` (schema.ts:274) **and** `tickets.modMessageId` (schema.ts:297) — these are the two `// Drop on Neon move` columns, and they live on **different tables** (`modMessageId` is on `tickets`, NOT `ticket_config`). The target schema no longer has them, so a "copy every column" insert will fail. The script must select only surviving columns.
  - **Make the script self-guarding / idempotent:** abort if any target table is non-empty, so an accidental re-run can't collide on explicit-id inserts.
- [ ] **Run the full pipeline locally first:** migrate into local Postgres, then run the bot/api against local PG (`DATABASE_URL=postgres://localhost…`) and exercise message XP, voice join/leave, attendance, a slash command, and the dashboard. Fix everything here where iteration is free and there's no Neon blast radius.
- [ ] **Verify locally:** row-count parity per table (assert-equal; fail loud on mismatch) + spot-check high-value rows (top XP members, event 5 attendance, a transcript_job).
- [ ] **Only once local is green:** run the *same* migrations + the *same* script against Neon (target URL = Neon direct), and re-run the identical row-count/spot-check verification against Neon.
- [ ] Keep Turso **read-only as fallback** until the new stack is confirmed healthy (do not delete for ≥1 week).

### Phase 5 — Deploy / infra
- [ ] `packages/core/package.json`: remove `libsql`, `@libsql/client`, `better-sqlite3`; add `pg` + `@types/pg` **and `cloudinary`** (image store, §2.2). Update `drizzle-orm` if needed for pg-core.
- [ ] Root `package.json`: drop `libsql`/`better-sqlite3` from `onlyBuiltDependencies` (no more native builds → **faster, less OOM-prone** on the 1-CPU/no-swap box).
- [ ] [`Dockerfile`](../Dockerfile): the `toolchain` native-build stage is no longer needed for DB (still needed for `@discordjs/opus`); `ca-certificates` in `base` still fine to keep for TLS to Neon.
- [ ] [`docker-compose.yml`](../docker-compose.yml): `migrate` one-shot now runs `drizzle-kit migrate` against Neon **direct** URL; ensure `.env` carries `DATABASE_DIRECT_URL`.
- [ ] Add `ssl` handling: rely on Neon's `?sslmode=require` in the pooled/direct URLs (paste verbatim) **or** set `ssl: { rejectUnauthorized: true }` in the `Pool`; assert `sslmode=require` in [`env.ts`](../packages/core/src/env.ts) validation so a stripped URL can't silently disable TLS. Add a `statement_timeout`/`query_timeout` (~10s) so a slow Neon query can't stack ticks.

**Cutover is a one-time MANUAL deploy — the normal `.github/workflows/deploy.yml` auto-fires on push to `main` and will start + health-gate the bot, which conflicts with "bot stopped until verified". Do the cutover by hand, then re-enable auto-deploy.** Ordered sequence:

- [ ] **Prove locally first** (Phase 4): export Turso → local Postgres → run bot/api against local PG → verify. Iterate freely here.
- [ ] Provision Neon; run `drizzle-kit migrate` against the Neon **direct** URL (schema only).
- [ ] **Stop the old (`main`/Turso) bot / announce a write freeze.** The old bot keeps writing XP/attendance until you stop it — any writes between your export and cutover are **lost**. The export that goes to Neon must be the **final** one, taken *after* writes stop (your earlier local-test export is a different, stale snapshot — don't ship it).
- [ ] Run the **guarded** `migrate-to-postgres.ts` once against Neon direct → load data.
- [ ] **Verify against Neon** (not just local): row-count parity per table + spot-check top-XP members / event attendance / a transcript_job.
- [ ] **Update GitHub Actions secrets BEFORE merging** (`deploy.yml` runs on push to `main`, so stale secrets = failed auto-deploy): `PROD_ENV` → `postgres://` **pooled** `DATABASE_URL` + add `DATABASE_DIRECT_URL`; point the runner `migrate` job at the **direct** URL; drop `DATABASE_AUTH_TOKEN`. Note `secrets.json` is **local-only** (rsync-excluded, never reaches the VPS) — prod secrets live in GitHub Actions.
- [ ] Merge `feat/postgres-migration` → `main` (or trigger a manual deploy). The auto-deploy re-runs `drizzle-kit migrate` (idempotent) and starts services. The one-shot data script is **never** wired into `deploy.yml`.
- [ ] Watch a full quiet cycle (≥10 min idle + an active voice session) with **zero** restarts. (No HTTP `/health` exists — the deploy health check is container-liveness only; consider adding a real readiness probe post-migration.)

### Phase 6 — Cutover + cleanup
- [ ] Confirm dashboard analytics read correctly from Neon.
- [ ] Write **ADR 0006 — "Neon Postgres via async node-postgres, superseding ADR 0002"**.
- [ ] Update `CONTEXT.md`, `README.md`, and the deployment memory (Turso → Neon; sync → async).
- [ ] After ≥1 week healthy: decommission the Turso DB and remove `DATABASE_AUTH_TOKEN`.

---

## 5. Testing & verification
- **Build/type:** `tsc` clean across all packages (this is the primary async-conversion guardrail).
- **Lint:** `biome` clean.
- **Local:** point `DATABASE_URL` at a Neon **branch** (Neon supports DB branching) or a local Docker Postgres; run bot with `XP_TICK_SECONDS=2` and exercise message XP, voice join/leave, attendance, a slash command, and the dashboard.
- **Data integrity:** row-count parity assertions in the migration script; manual spot-checks.
- **Resilience:** kill the DB connection mid-run (or pause the Neon compute) and confirm the bot logs, retries, and recovers — **does not exit** (validates Phase 0 + pg auto-reconnect).

## 6. Rollback
- Phases 0–4 happen on `feat/postgres-migration`; `main` (Turso) stays deployable throughout.
- Turso is retained read-only ≥1 week, so cutover is reversible by redeploying `main` + repointing env.
- The data-migration script is one-way (Turso→Neon); any writes to Neon after cutover would be lost on rollback — acceptable given the short bake window, but note it.

## 7. Risk register
| Risk | Likelihood | Mitigation |
|---|---|---|
| Missed `await` on a fire-and-forget write → silent Promise / dropped write | **High** | `tsc` does **not** catch these; hard CI gate on Biome ≥2.4 `noFloatingPromises`/`noMisusedPromises` (type-aware) + a minimal typescript-eslint second net (gold-standard for drizzle thenables per biome#8476). **Named hot spots: `tick.ts:108/120` (`recordDuration`/`grantTick`) and `index.ts:32` (`sweepMissedAnnouncements`).** |
| **Neon free-tier compute-hours exhausted → compute suspended → outage** | **High** | Always-on reconcile loop pins compute ~24/7 ≈ ~182 CU-hr/mo vs ~192 cap. **Memoize `getConfig`/`listEvents` in memory (invalidate on write)** so the idle loop touches no DB and Neon scales to zero; else move to paid Launch. See §2. |
| Lost writes during the migration window | **High** | Old Turso bot keeps writing until stopped. **Stop it / freeze writes before the authoritative export**; take the final export after writes cease. |
| ~~Sync→async transaction callback~~ (N/A) | — | **Zero `db.transaction()` sites exist** — this risk does not apply to this codebase. |
| Autoincrement sequence collision after import | Med | `setval()` the **7** real sequences to `max(id)+1` post-import; target them **by name**. The other **9** tables have no sequence (3 text PK + **6** composite PK incl. `members`/`admins`) — a generic "reset every `id_seq`" loop errors on them. Test an insert after. |
| pgBouncer transaction-mode + prepared statements | Low | node-postgres works with Neon pooled; Drizzle only issues server-side prepared statements on explicit `.prepare()` — avoid long-lived prepared handles against the pooled URL; disable prepared statements if `prepared statement "…" does not exist` appears under load |
| epoch-second vs timestamptz confusion | Low | Keep epoch `bigint` for now — zero semantic change; defer timestamptz to a later ADR |
| Native-dep/Docker build breakage | Low | Removing libsql/better-sqlite3 simplifies the build; verify `@discordjs/opus` still compiles |
| **Cloudinary free-tier exhausted → uploads blocked / account suspended** | Med | 25 credits/mo (1 GB storage or 1 GB bandwidth each). `destroy()` on ticket purge; cap upload size; store original + a few named derived sizes; monitor usage. Same hard-outage shape as the Neon tier. |
| Private attachment leaked via public CDN URL | Med | Upload `type:'authenticated'`; serve short-lived **signed** delivery URLs from the API; never hand out a raw public `secure_url` for private-thread attachments. |
| Cloudinary API key missing / upload path throws | Med | API key still blank in `secrets.json` — fill before Phase 3. Wrap uploads in try/catch (Phase-0 rule): a failed upload keeps the ticket and retries later, never crashes the handler. |
| Crash recurs from a *different* uncaught path | Med | Phase 0 global handlers are the backstop, not just per-loop try/catch |

## 8. Task checklist (condensed)
- [ ] **P0** error containment (mergeable alone)
- [ ] **P1** provision Neon + env/secrets wiring
- [ ] **P2** schema → pg-core + regenerate migration
- [ ] **P3** client → pg.Pool + full async conversion (core → services → bot/api/web)
- [ ] **P4** data migration script + row-count verification
- [ ] **P5** deps/Dockerfile/compose + deploy
- [ ] **P6** cutover, ADR 0006, docs, decommission Turso

---

## 9. Resources & references

**The incident / root cause (libsql idle-stream wedge):**
- Turso libsql #985 — "The stream has expired due to inactivity": https://github.com/tursodatabase/libsql/issues/985
- Turso libsql #2083 — Embedded Replica update fails, 404 "stream not found": https://github.com/tursodatabase/libsql/issues/2083
- go-libsql #13 — Hrana `STREAM_EXPIRED`: https://github.com/tursodatabase/go-libsql/issues/13
- go-libsql #12 — same, inactivity: https://github.com/tursodatabase/go-libsql/issues/12
- libsql-experimental-python #41: https://github.com/tursodatabase/libsql-experimental-python/issues/41

**Neon + Drizzle (target stack):**
- Drizzle ORM — Neon connect guide: https://orm.drizzle.team/docs/connect-neon
- Drizzle ORM — node-postgres connect guide: https://orm.drizzle.team/docs/get-started-postgresql
- Neon Docs — Connect from Drizzle: https://neon.com/docs/guides/drizzle
- Neon Docs — Serverless driver (neon-http vs neon-serverless): https://neon.com/docs/serverless/serverless-driver
- Neon Docs — Connection latency & timeouts (scale-to-zero, cold start): https://neon.com/docs/connect/connection-latency
- Neon FAQ — best Postgres for Drizzle/Prisma TS apps: https://neon.com/faqs/best-postgres-services-javascript-typescript-drizzle-prisma
- Encore — Neon Serverless Postgres for TS backends (2026): https://encore.dev/articles/neon-serverless-postgres

**Driver / pooling background:**
- node-postgres (`pg`) Pool docs: https://node-postgres.com/apis/pool
- Neon — connection pooling (pgBouncer, pooled vs direct): https://neon.com/docs/connect/connection-pooling

**Package references:**
- `libsql` (npm, current sync driver): https://www.npmjs.com/package/libsql
- `@libsql/client` (used by the migration read step): https://www.npmjs.com/package/@libsql/client

**Cloudinary (ticket-attachment image storage — §2.2):**
- Cloudinary Node.js SDK — integration + config: https://cloudinary.com/documentation/node_integration
- Node.js image & video upload: https://cloudinary.com/documentation/node_image_and_video_upload
- Upload API reference (`upload`, `destroy`, params): https://cloudinary.com/documentation/image_upload_api_reference
- Generating authentication signatures (server-side signed uploads): https://cloudinary.com/documentation/authentication_signatures
- Signed delivery URLs — why & how: https://cloudinary.com/blog/signed-urls-the-why-and-how
- Pricing / free-tier credits (25/mo = 1 GB storage or 1 GB bandwidth each): https://cloudinary.com/pricing

**Superseded internal decision:**
- ADR 0002 — Turso libsql sync drop-in: [`docs/adr/0002-turso-libsql-sync-drop-in-for-production-db.md`](./adr/0002-turso-libsql-sync-drop-in-for-production-db.md)

---

## 10. Revision history
Track material changes to this plan here, newest first. Each row: date, what changed, why.

| Date | Change | Why |
|---|---|---|
| 2026-07-18 | Phase 4 + risk register: completed the sequence-less-table list — there are **6 composite-PK tables** (added `members` + `admins`, previously only 4 implied), not just the 3 text PKs. Emphasised `setval` the 7 sequences **by name**. | Independent codebase verification found `members` and `admins` are also composite-PK/no-sequence; a generic "reset every `id_seq`" loop would error on all 9 sequence-less tables, not just 3. |
| 2026-07-18 | Reworked **§2.3** to use **Pino's async file destination (SonicBoom)** instead of a hand-rolled sync `appendFileSync` sink: `sync:false`+`minLength` buffered writes, crash-durability via `pino.final`+`flushSync()` in the Phase-0 handlers, and OS `logrotate` (drops in-process rotation). Declare `pino` as an explicit direct dep in api+bot. | Pino v10 + sonic-boom are already in the tree (via Fastify) and the API already logs through Pino; sync-per-line would stall the event loop under the planned debug logging. Async + explicit flush-on-crash is the standard Pino pattern and converges both services on one primitive. |
| 2026-07-18 | Added **§2.3**: persist logs to a **host bind-mount** (`./data/logs/{bot,api}.log`) that survives `down --remove-orphans` / container removal / daemon crash; added the matching Phase-0 checklist item. | Both processes log only to stdout, and `docker compose down --remove-orphans` (run every deploy) deletes container logs — so debug logs vanished exactly when needed. `./data/` is already rsync-`--delete`-safe, so a host file survives deploys without touching the deploy flow. |
| 2026-07-18 | Added **§2.2**: ticket-attachment images move to **Cloudinary** (off-DB), retiring the only `bytea` column; folded schema/env/deps/backfill items into the phases; added free-tier + private-delivery + missing-API-key risks and Cloudinary refs. Stored cloud name + API secret in `secrets.json` (API key still needed). | Storing image bytes in `bytea` was the main threat to Neon's ~0.5 GB tier; object storage was already flagged as the follow-up — now decided. |
| 2026-07-18 | Corrected Phase 4: `modMessageId` lives on `tickets`, not `ticket_config` (the two `// Drop on Neon move` columns are on different tables). | Independent re-review caught the conflation; a "copy surviving columns" script would look on the wrong table. |
| 2026-07-18 | Specified concrete `pg.Pool` sizing (`max: 5`/process, `idleTimeoutMillis`, `connectionTimeoutMillis`, `keepAlive`) with the bot+api shared-budget note. | Review flagged `max` was left unspecified against Neon's connection ceiling. |
| 2026-07-18 | Added Biome `^1.9.4 → ≥2.4` **major-version upgrade** as an explicit prerequisite, and wired the floating-promise gate into CI (`typecheck` + `biome check` at error severity). | Repo is pinned to Biome 1.9.4 where the type-aware `noFloatingPromises`/`noMisusedPromises` rules don't exist — the "load-bearing" lint gate depended on tooling not present. |
| 2026-07-18 | Added `blob → bytea` and `real → real/doublePrecision` to the Phase 2 type-mapping table; flagged Neon free-tier blob storage risk; fixed table count 17 → 16. | Independent review found two used column types missing from the mapping and an inconsistent table count. |
| 2026-07-18 | Added the concrete `.get()/.all()/.run()/.values()` → async pg-core method-mapping table and corrected the "`tsc` catches every un-awaited Promise" overclaim (fire-and-forget writes are the real gap). | Sync→async is the bulk of the work; the guardrail claim was optimistic. |
| 2026-07-18 | Rewrote Phase 4 to **local-Postgres-first** (export Turso → local Docker PG → verify → same drizzle migrations + script against Neon). | Prove the pipeline where iteration is free, with schema parity guaranteed by running identical migrations everywhere. |

> Still open (not yet folded in): lock ID strategy to `serial`/`GENERATED BY DEFAULT` (not `generatedAlways`); pin exact `setval` form + re-run/idempotency contract in Phase 4; promote blob-size measurement and a post-migration Neon `pg_dump` to hard checklist gates; add DAO-level integration tests against the Phase-4 local Postgres; **obtain the Cloudinary API key**; confirm the Cloudinary **authenticated-upload + signed-delivery** approach for private attachments (vs. plain public `upload`).
