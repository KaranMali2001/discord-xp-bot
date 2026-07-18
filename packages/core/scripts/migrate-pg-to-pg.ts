/**
 * Postgres → Postgres data copy. Both sides share the IDENTICAL pg-core schema (the target is
 * created first with `drizzle-kit migrate`), so this is a straight, transform-free copy — no
 * boolean coercion, no blob handling, no dropped columns (all of that already happened on the
 * way INTO the source Postgres via migrate-to-postgres.ts). That's the point: do the messy
 * Turso→Postgres transform once locally, verify it, then push local → Neon as a dumb copy where
 * far less can go wrong against prod.
 *
 * Preserves every column (incl. primary keys) verbatim, resets the 7 sequences to max(id)+1,
 * runs inside ONE transaction on the target (rollback on any error), self-guards against a
 * non-empty target, and asserts per-table row-count parity.
 *
 * Usage:
 *   MIGRATE_SOURCE_URL=postgres://…localhost:5432/xp \
 *   MIGRATE_TARGET_URL=<neon-direct-url> \
 *     tsx scripts/migrate-pg-to-pg.ts [--force]
 *   (MIGRATE_SOURCE_URL defaults to DATABASE_URL from the workspace .env.)
 */
import { join } from 'node:path'
import { config as loadEnv } from 'dotenv'
import { Pool } from 'pg'
import { findWorkspaceRoot } from '../src/util/paths'

loadEnv({ path: join(findWorkspaceRoot(), '.env') })

const SOURCE_URL = process.env.MIGRATE_SOURCE_URL ?? process.env.DATABASE_URL
const TARGET_URL = process.env.MIGRATE_TARGET_URL
const FORCE = process.argv.includes('--force')

if (!SOURCE_URL) throw new Error('MIGRATE_SOURCE_URL (or DATABASE_URL) must be set')
if (!TARGET_URL) throw new Error('MIGRATE_TARGET_URL must be set (the destination Postgres/Neon)')
for (const [name, url] of [
  ['source', SOURCE_URL],
  ['target', TARGET_URL],
]) {
  if (!/^postgres(ql)?:\/\//.test(url)) {
    throw new Error(`refusing to run: ${name} is not a postgres:// URL (got ${url.slice(0, 12)}…)`)
  }
}
if (SOURCE_URL === TARGET_URL)
  throw new Error('refusing to run: source and target are the same URL')

// Parents before children (no DB-level FKs, but keep logical order).
const TABLE_ORDER = [
  'guild_config',
  'members',
  'admins',
  'channel_rules',
  'multiplier_events',
  'level_rewards',
  'badges',
  'member_badges',
  'event_attendance',
  'event_voice_stats',
  'scheduled_announcements',
  'transcript_jobs',
  'ticket_config',
  'tickets',
  'ticket_participants',
  'ticket_attachments',
]

// The 7 tables with an autoincrement sequence — setval BY NAME (the other 9 have no sequence).
const SEQUENCE_TABLES = [
  'channel_rules',
  'multiplier_events',
  'level_rewards',
  'badges',
  'scheduled_announcements',
  'tickets',
  'ticket_attachments',
]

const qy = (id: string) => `"${id}"`

async function main() {
  const source = new Pool({ connectionString: SOURCE_URL })
  const target = new Pool({ connectionString: TARGET_URL })

  let totalCopied = 0
  const client = await target.connect()
  try {
    await client.query('BEGIN')

    // self-guard: every target table must be empty (unless --force)
    if (!FORCE) {
      for (const table of TABLE_ORDER) {
        const { rows } = await client.query(`SELECT count(*)::int AS n FROM ${qy(table)}`)
        if (rows[0].n > 0) {
          throw new Error(
            `target table "${table}" is not empty (${rows[0].n} rows). Refusing to run — drop/recreate the target DB (or pass --force). This prevents explicit-id collisions on re-run.`,
          )
        }
      }
    }

    for (const table of TABLE_ORDER) {
      const read = await source.query(`SELECT * FROM ${qy(table)}`)
      const rows = read.rows
      if (rows.length > 0) {
        // Column names come straight off the source result — identical schema, so copy verbatim.
        const cols = read.fields.map((f) => f.name)
        // pg caps a statement at 65535 params; chunk the multi-row insert to stay well under it.
        const chunkSize = Math.max(1, Math.floor(60000 / cols.length))
        for (let i = 0; i < rows.length; i += chunkSize) {
          const chunk = rows.slice(i, i + chunkSize)
          const params: unknown[] = []
          const tuples = chunk.map((row, r) => {
            const ph = cols.map((_, c) => `$${r * cols.length + c + 1}`)
            for (const col of cols) params.push(row[col])
            return `(${ph.join(', ')})`
          })
          await client.query(
            `INSERT INTO ${qy(table)} (${cols.map(qy).join(', ')}) VALUES ${tuples.join(', ')}`,
            params,
          )
        }
      }
      totalCopied += rows.length
      console.log(`  copied ${String(rows.length).padStart(6)} → ${table}`)
    }

    // reset the 7 sequences BY NAME to max(id)+1 (empty table → next 1).
    for (const table of SEQUENCE_TABLES) {
      await client.query(
        `SELECT setval('${table}_id_seq', COALESCE((SELECT MAX(id) FROM ${qy(table)}), 1), (SELECT count(*) FROM ${qy(table)}) > 0)`,
      )
    }

    await client.query('COMMIT')
  } catch (e) {
    await client.query('ROLLBACK')
    throw e
  } finally {
    client.release()
  }

  // row-count parity: source vs target, fail loud on mismatch.
  let mismatches = 0
  for (const table of TABLE_ORDER) {
    const s = (await source.query(`SELECT count(*)::int AS n FROM ${qy(table)}`)).rows[0].n
    const t = (await target.query(`SELECT count(*)::int AS n FROM ${qy(table)}`)).rows[0].n
    const ok = s === t
    if (!ok) mismatches++
    console.log(`  ${ok ? '✓' : '✗'} ${table.padEnd(24)} source=${s} target=${t}`)
  }

  await source.end()
  await target.end()

  if (mismatches > 0) {
    console.error(`\n❌ ${mismatches} table(s) failed row-count parity`)
    process.exit(1)
  }
  console.log(`\n✅ pg→pg copy complete — ${totalCopied} rows copied, all tables parity-verified`)
}

main().catch((e) => {
  console.error('❌ pg→pg migration failed:', e)
  process.exit(1)
})
