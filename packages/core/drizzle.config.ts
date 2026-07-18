import { defineConfig } from 'drizzle-kit'
import { requireSsl } from './src/util/db-url'

// Read the DB URL directly (not the full validated env) so migrations don't require
// DISCORD_TOKEN etc. Migrations run against the DIRECT (non-pooled) Postgres URL — pgBouncer
// drops the sessions drizzle-kit needs. Falls back to DATABASE_URL (a local Postgres isn't
// pooled, so the two are the same locally).
const raw = process.env.DATABASE_DIRECT_URL || process.env.DATABASE_URL
if (!raw) throw new Error('DATABASE_DIRECT_URL or DATABASE_URL must be set for drizzle-kit')

// drizzle-kit IGNORES a `ssl` credential option for the URL variant (it builds its own Pool from
// just the connection string), so enforce TLS the only way it honours: bake `sslmode=require`
// into the URL for any remote host (Neon). Local (localhost / docker service name) stays plaintext.
function withSsl(url: string): string {
  if (!requireSsl(url)) return url
  try {
    const u = new URL(url)
    if (!u.searchParams.has('sslmode')) u.searchParams.set('sslmode', 'require')
    return u.toString()
  } catch {
    return url
  }
}

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './drizzle',
  dbCredentials: { url: withSsl(raw) },
})
