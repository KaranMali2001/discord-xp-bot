/**
 * One-shot, idempotent, verifiable data migration: sqlite source → Postgres. The target URL
 * is a parameter (local Postgres now; the same script points at Neon direct at cutover), so
 * the pipeline is proved locally with zero prod blast radius.
 *
 * It preserves primary keys, coerces sqlite 0/1 → pg boolean, skips the two deprecated columns
 * the Neon schema drops (`ticket_config.mod_channel_id`, `tickets.mod_message_id`), replaces
 * the `ticket_attachments.data` BLOB with an empty Cloudinary reference (bytes go off-DB, §2.2 —
 * the backfill uploads them later), then setval()s the 7 real sequences BY NAME and asserts
 * per-table row-count parity. Self-guards: aborts if any target table is non-empty (pass
 * --force to bypass), so an accidental re-run can't collide on explicit-id inserts.
 *
 * Usage:
 *   MIGRATE_SOURCE=./migration-source.sqlite MIGRATE_TARGET_URL=postgres://... tsx scripts/migrate-to-postgres.ts [--force]
 *   (both default to ./migration-source.sqlite and DATABASE_URL from the workspace .env)
 */
import { join } from 'node:path'
import Database from 'better-sqlite3'
import { config as loadEnv } from 'dotenv'
import { Pool } from 'pg'
import { findWorkspaceRoot } from '../src/util/paths'

loadEnv({ path: join(findWorkspaceRoot(), '.env') })

const SOURCE = process.env.MIGRATE_SOURCE ?? './migration-source.sqlite'
const TARGET = process.env.MIGRATE_TARGET_URL ?? process.env.DATABASE_URL
const FORCE = process.argv.includes('--force')

if (!TARGET) throw new Error('MIGRATE_TARGET_URL or DATABASE_URL must be set')
if (!/^postgres(ql)?:\/\//.test(TARGET)) {
  throw new Error(`refusing to run: target is not a postgres:// URL (got ${TARGET.slice(0, 12)}…)`)
}

interface TableSpec {
  table: string
  bool?: string[] // 0/1 → boolean
  drop?: string[] // sqlite columns NOT copied (dropped on the Neon move)
  add?: Record<string, unknown> // extra target columns with fixed values
}

// Parents before children (no DB-level FKs, but keep logical order).
const SPECS: TableSpec[] = [
  { table: 'guild_config', bool: ['ignore_muted_voice'] },
  { table: 'members' },
  { table: 'admins' },
  { table: 'channel_rules', bool: ['no_xp'] },
  { table: 'multiplier_events', bool: ['enabled', 'counts_attendance'] },
  { table: 'level_rewards' },
  { table: 'badges' },
  { table: 'member_badges' },
  { table: 'event_attendance' },
  { table: 'event_voice_stats' },
  { table: 'scheduled_announcements', bool: ['mention_everyone'] },
  { table: 'transcript_jobs' },
  { table: 'ticket_config', bool: ['enabled'], drop: ['mod_channel_id'] },
  { table: 'tickets', drop: ['mod_message_id'] },
  { table: 'ticket_participants' },
  {
    table: 'ticket_attachments',
    drop: ['data'],
    add: { cloudinary_public_id: '', url: '' },
  },
]

// The 7 tables with an autoincrement sequence — setval these BY NAME. The other 9 have no
// sequence (3 text PK + 6 composite PK) and a blanket "reset every _id_seq" loop would error.
const SEQUENCE_TABLES = [
  'channel_rules',
  'multiplier_events',
  'level_rewards',
  'badges',
  'scheduled_announcements',
  'tickets',
  'ticket_attachments',
]

async function main() {
  const sqlite = new Database(SOURCE, { readonly: true })
  const pool = new Pool({ connectionString: TARGET })

  // Measure blob size from the ACTUAL bytes (size_bytes is only set on the bot download path,
  // so sum(size_bytes) would undercount) — sizes the future Cloudinary backfill.
  const blob = sqlite
    .prepare(
      'SELECT count(*) n, coalesce(sum(length(data)),0) total, coalesce(max(length(data)),0) max FROM ticket_attachments',
    )
    .get() as { n: number; total: number; max: number }
  console.log(
    `ℹ️  ticket_attachments blobs: count=${blob.n} totalBytes=${blob.total} maxBytes=${blob.max}`,
  )

  // ── transactional copy: the self-guard, all 16 tables' inserts, and the sequence resets
  // run in ONE transaction, so a mid-run failure (e.g. a blip at Neon cutover) ROLLS BACK
  // cleanly instead of leaving a half-migrated DB with un-reset sequences. ──
  let totalCopied = 0
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // self-guard: every target table must be empty (unless --force)
    if (!FORCE) {
      for (const { table } of SPECS) {
        const { rows } = await client.query(`SELECT count(*)::int AS n FROM ${table}`)
        if (rows[0].n > 0) {
          throw new Error(
            `target table "${table}" is not empty (${rows[0].n} rows). Refusing to run — drop/recreate the DB (or pass --force). This prevents explicit-id collisions on re-run.`,
          )
        }
      }
    }

    // copy, preserving PKs
    for (const spec of SPECS) {
      const srcRows = sqlite.prepare(`SELECT * FROM ${spec.table}`).all() as Record<
        string,
        unknown
      >[]
      for (const src of srcRows) {
        const row: Record<string, unknown> = {}
        for (const [col, val] of Object.entries(src)) {
          if (spec.drop?.includes(col)) continue
          row[col] = spec.bool?.includes(col) ? Boolean(val) : val
        }
        Object.assign(row, spec.add ?? {})

        const cols = Object.keys(row)
        const params = cols.map((_, i) => `$${i + 1}`)
        await client.query(
          `INSERT INTO ${spec.table} (${cols.map((c) => `"${c}"`).join(', ')}) VALUES (${params.join(', ')})`,
          cols.map((c) => row[c]),
        )
      }
      totalCopied += srcRows.length
      console.log(`  copied ${String(srcRows.length).padStart(4)} → ${spec.table}`)
    }

    // reset the 7 sequences BY NAME to max(id)+1 (value=max, is_called=true → next=max+1;
    // empty table → setval(1, false) → next 1).
    for (const table of SEQUENCE_TABLES) {
      await client.query(
        `SELECT setval('${table}_id_seq', COALESCE((SELECT MAX(id) FROM ${table}), 1), (SELECT count(*) FROM ${table}) > 0)`,
      )
    }

    await client.query('COMMIT')
  } catch (e) {
    await client.query('ROLLBACK')
    throw e
  } finally {
    client.release()
  }

  // ── row-count parity: fail loud on any mismatch ──
  let mismatches = 0
  for (const { table } of SPECS) {
    const srcN = (sqlite.prepare(`SELECT count(*) n FROM ${table}`).get() as { n: number }).n
    const { rows } = await pool.query(`SELECT count(*)::int AS n FROM ${table}`)
    const dstN = rows[0].n
    const ok = srcN === dstN
    if (!ok) mismatches++
    console.log(`  ${ok ? '✓' : '✗'} ${table.padEnd(24)} sqlite=${srcN} pg=${dstN}`)
  }

  // ── spot-check a high-value row + confirm the transforms landed ──
  const alice = (
    await pool.query('SELECT xp, level FROM members WHERE guild_id=$1 AND user_id=$2', [
      'guild_001',
      'user_a',
    ])
  ).rows[0]
  const cfg = (
    await pool.query('SELECT ignore_muted_voice FROM guild_config WHERE guild_id=$1', ['guild_001'])
  ).rows[0]
  const att = (
    await pool.query('SELECT cloudinary_public_id, url, size_bytes FROM ticket_attachments LIMIT 1')
  ).rows[0]
  console.log('  spot-check: Alice xp/level =', alice?.xp, '/', alice?.level, '(expect 1500/5)')
  console.log(
    '  spot-check: ignore_muted_voice =',
    cfg?.ignore_muted_voice,
    'typeof',
    typeof cfg?.ignore_muted_voice,
    '(expect boolean false)',
  )
  console.log(
    '  spot-check: attachment ref =',
    JSON.stringify(att),
    '(cloudinary empty, size kept)',
  )

  // ticket columns dropped from target schema must be gone (query would error if present)
  const droppedGone = await pool
    .query('SELECT mod_message_id FROM tickets LIMIT 1')
    .then(() => false)
    .catch(() => true)
  console.log('  dropped cols gone (tickets.mod_message_id absent) =', droppedGone, '(expect true)')

  sqlite.close()
  await pool.end()

  if (mismatches > 0) {
    console.error(`\n❌ ${mismatches} table(s) failed row-count parity`)
    process.exit(1)
  }
  console.log(`\n✅ migration complete — ${totalCopied} rows copied, all tables parity-verified`)
}

main().catch((e) => {
  console.error('❌ migration failed:', e)
  process.exit(1)
})
