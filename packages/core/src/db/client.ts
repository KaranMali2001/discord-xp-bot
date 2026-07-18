import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool, type PoolConfig } from 'pg'
import { env } from '../env'
import { requireSsl } from '../util/db-url'
import * as schema from './schema'

/**
 * Postgres via node-postgres `Pool` (Neon in prod, a local Postgres in dev). We're a long-lived
 * VPS process, not edge, so a TCP pool gives full transaction support and — crucially —
 * auto-reconnect: a dead client is evicted and a fresh one opened, so there's no permanent
 * connection wedge like the old libsql sync stream (the reason for this migration).
 */

// Enforce verified TLS for any REMOTE host (Neon and every non-local Postgres). node-postgres
// only honours `sslmode` from the URL when NO `ssl` option is given; by passing an explicit
// `ssl` object we both force TLS *and* verify the server certificate (rejectUnauthorized:true) —
// so a URL that forgot `?sslmode=require` can never silently fall back to cleartext. Local dev
// (localhost / a docker service hostname) stays plaintext. See util/db-url.ts.
const ssl: PoolConfig['ssl'] = requireSsl(env.DATABASE_URL) ? { rejectUnauthorized: true } : false

export const pool = new Pool({
  connectionString: env.DATABASE_URL, // pooled (pgBouncer) endpoint in prod; local Postgres in dev
  ssl,
  max: 5, // per process; bot(5) + api(5) = 10 total, well under Neon's connection ceiling
  idleTimeoutMillis: 30_000, // evict idle clients before the server's own idle timeout
  connectionTimeoutMillis: 10_000, // fail fast on a wedged connect instead of hanging a tick
  keepAlive: true, // TCP keepalive so idle sockets aren't silently dropped
})

// node-postgres emits pool-level errors (e.g. the backend terminating an idle client) on the
// pool itself; an unhandled 'error' here would be fatal, so swallow-and-log — the pool opens a
// fresh client on the next query.
pool.on('error', (err) => {
  console.error('[db] unexpected pool error:', err instanceof Error ? err.message : err)
})

export const db = drizzle(pool, { schema })
export type DB = typeof db
