/**
 * READ-ONLY export of the production Turso DB into a local sqlite file — the real-data source
 * for migrate-to-postgres.ts. It mirrors every user table (schema + rows) verbatim, including
 * the legacy columns the Postgres move later drops (mod_channel_id, mod_message_id) and the
 * ticket_attachments.data BLOB, so the downstream transform has everything it needs.
 *
 * Turso is only ever READ here (never written). The output sqlite + the local Postgres it feeds
 * are gitignored, so prod data never lands in git. Neon is not involved.
 *
 * Creds come from secrets.json { turso: { databaseUrl, authToken } } (or TURSO_URL/TURSO_AUTH_TOKEN).
 *
 * Usage: tsx scripts/export-turso.ts [outfile]   (default ./migration-source.sqlite)
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createClient } from '@libsql/client'
import Database from 'better-sqlite3'
import { findWorkspaceRoot } from '../src/util/paths'

const root = findWorkspaceRoot()
const secrets = JSON.parse(readFileSync(join(root, 'secrets.json'), 'utf8'))
const url = process.env.TURSO_URL ?? secrets.turso?.databaseUrl
const authToken = process.env.TURSO_AUTH_TOKEN ?? secrets.turso?.authToken
const OUT = process.argv[2] ?? './migration-source.sqlite'

if (!url || !authToken)
  throw new Error(
    'Turso databaseUrl/authToken missing (secrets.json.turso or TURSO_URL/TURSO_AUTH_TOKEN)',
  )
if (!/^libsql:\/\//.test(url))
  throw new Error(`refusing: source is not a libsql:// Turso URL (got ${url.slice(0, 12)}…)`)

function toSqliteValue(v: unknown): unknown {
  // libsql returns BLOBs as ArrayBuffer; better-sqlite3 binds Buffer.
  if (v instanceof ArrayBuffer) return Buffer.from(v)
  if (v instanceof Uint8Array) return Buffer.from(v)
  return v
}

async function main() {
  const turso = createClient({ url, authToken })
  const local = new Database(OUT)
  local.pragma('journal_mode = WAL')

  // Every user table, with its exact Turso DDL (skip sqlite internals + the drizzle tracker).
  const master = await turso.execute(
    `SELECT name, sql FROM sqlite_master
     WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_litestream%'
       AND name != '__drizzle_migrations' AND sql IS NOT NULL
     ORDER BY name`,
  )

  let grandTotal = 0
  for (const t of master.rows) {
    const name = String(t.name)
    const ddl = String(t.sql)
    local.exec(`DROP TABLE IF EXISTS "${name}"`)
    local.exec(ddl) // recreate with Turso's exact (old) schema

    const data = await turso.execute(`SELECT * FROM "${name}"`)
    if (data.rows.length > 0) {
      const cols = data.columns
      const insert = local.prepare(
        `INSERT INTO "${name}" (${cols.map((c) => `"${c}"`).join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
      )
      const insertMany = local.transaction((rows: typeof data.rows) => {
        for (const row of rows) insert.run(cols.map((c) => toSqliteValue(row[c])))
      })
      insertMany(data.rows)
    }
    grandTotal += data.rows.length
    console.log(`  exported ${String(data.rows.length).padStart(6)} → ${name}`)
  }

  local.close()
  turso.close()
  console.log(
    `\n✅ Turso → ${OUT} — ${master.rows.length} tables, ${grandTotal} rows (read-only, prod untouched)`,
  )
}

main().catch((e) => {
  console.error('❌ turso export failed:', e)
  process.exit(1)
})
