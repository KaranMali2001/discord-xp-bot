# CI/CD

Two GitHub Actions workflows.

## `ci.yml` — on pull requests
Typecheck + Biome lint for the four app packages (`core` / `api` / `bot` / `web`).
`packages/landing` is excluded (it has its own pre-existing type issues). Native modules
aren't built (`--ignore-scripts`) since checks don't need them.

## `deploy.yml` — on push to `main` (or manual)
Three sequential jobs — a bad push never deploys, and the DB is migrated before new code ships:

1. **check** — same typecheck + lint gate as CI.
2. **migrate** — `pnpm --filter @xp/core db:migrate` against **Turso**. Drizzle applies only
   pending migrations (recorded in `__drizzle_migrations`), so it's idempotent and safe to
   re-run. Migrations are additive (expand pattern), so the still-running old code is unaffected
   while this runs.
3. **deploy** — `rsync` the working tree to the VPS (never touching the untracked `.env`), then
   `docker compose up -d --build --force-recreate` + `docker image prune -f`, then a health check
   that fails the run if `api`/`bot`/`web` aren't `running`.

> The Compose stack also has a one-shot `migrate` service; it re-runs `db:migrate` on the VPS
> and is a no-op after step 2. Belt-and-suspenders.

## Required secrets
`Settings → Secrets and variables → Actions`:

| Secret | Value |
|---|---|
| `DATABASE_URL` | Turso libsql URL (`libsql://….turso.io`) |
| `DATABASE_AUTH_TOKEN` | Turso auth token |
| `VPS_HOST` | VPS IP / hostname |
| `VPS_USER` | SSH user (e.g. `root`) |
| `VPS_PASSWORD` | SSH password |

Deploy uses **username + password** over SSH (via `sshpass`), matching the VPS setup. The
password is passed through the `SSHPASS` env var — never on the command line or in logs.

An **`production` environment** is referenced by the migrate/deploy jobs — create it under
`Settings → Environments` (optionally add required reviewers to gate production).

> Security note: password auth works fine here. If you later want to harden it, swap
> `VPS_PASSWORD` for a deploy SSH key (`webfactory/ssh-agent` + key auth) — no other change needed.

## Notes / future improvements
- The VPS is small (1 CPU, disk ~80% full). Builds run **on the box** (~4 min) and the prune
  step reclaims space. If disk/CPU become a problem, switch to **build images in CI → push to
  GHCR → VPS pulls** (compose would reference images instead of `build:`), offloading the build.
- Migrations run from CI against production Turso — only run destructive/renaming migrations
  deliberately; the current set is additive.
