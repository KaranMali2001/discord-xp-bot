import { defineConfig } from 'drizzle-kit'
import { resolveDatabaseUrl } from './src/util/paths'

// Read DATABASE_URL directly (not the full validated env) so migrations don't
// require DISCORD_TOKEN etc. Anchor a local file to the workspace root so it's the
// SAME db the bot/api open (they run from different cwds).
const url = process.env.DATABASE_URL ?? 'file:./dev.db'
const isRemote = /^(libsql|https?|wss?):\/\//.test(url)

export default defineConfig(
  isRemote
    ? {
        // Turso (libsql) — migrations run against the remote DB with an auth token.
        dialect: 'turso',
        schema: './src/db/schema.ts',
        out: './drizzle',
        dbCredentials: { url, authToken: process.env.DATABASE_AUTH_TOKEN ?? '' },
      }
    : {
        dialect: 'sqlite',
        schema: './src/db/schema.ts',
        out: './drizzle',
        dbCredentials: { url: resolveDatabaseUrl(url) },
      },
)
