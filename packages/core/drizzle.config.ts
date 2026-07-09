import { defineConfig } from 'drizzle-kit'
import { resolveDatabaseUrl } from './src/util/paths'

// Read DATABASE_URL directly (not the full validated env) so migrations don't
// require DISCORD_TOKEN etc. Anchor the file to the workspace root so it's the
// SAME db the bot/api open (they run from different cwds).
const url = resolveDatabaseUrl(process.env.DATABASE_URL ?? 'file:./dev.db')

export default defineConfig({
  dialect: 'sqlite',
  schema: './src/db/schema.ts',
  out: './drizzle',
  dbCredentials: { url },
})
