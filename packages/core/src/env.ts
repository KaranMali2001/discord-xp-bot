import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { config } from 'dotenv'
import { z } from 'zod'
import { findWorkspaceRoot } from './util/paths'

// Load the workspace-root .env into process.env (each package runs from its own dir).
{
  const candidate = join(findWorkspaceRoot(), '.env')
  if (existsSync(candidate)) config({ path: candidate })
}

/**
 * Single validated env for the whole workspace. Every package imports from here,
 * so a missing/invalid var fails fast at boot instead of surfacing as a runtime
 * `undefined` deep in a handler. (This is the gap our previous projects had.)
 */
const schema = z.object({
  DISCORD_TOKEN: z.string().min(1),
  DISCORD_CLIENT_ID: z.string().min(1),
  DISCORD_CLIENT_SECRET: z.string().default(''),
  DISCORD_GUILD_ID: z.string().default(''),

  // Local dev: file:./dev.db. Production: a Turso libsql:// URL (+ DATABASE_AUTH_TOKEN).
  DATABASE_URL: z.string().default('file:./dev.db'),
  // Turso auth token — required only when DATABASE_URL is a libsql:// URL.
  DATABASE_AUTH_TOKEN: z.string().default(''),

  API_PORT: z.coerce.number().default(8080),
  // Public origin the API is reachable at (used for the Discord OAuth redirect URI).
  // Leave blank for local dev — falls back to http://localhost:${API_PORT}.
  PUBLIC_API_URL: z.string().default(''),
  WEB_URL: z.string().default('http://localhost:5173'),
  SESSION_SECRET: z.string().min(8).default('dev-only-insecure-session-secret'),

  // Local-only escape hatch: skip OAuth/session checks so the dashboard is fully
  // viewable and editable without logging in. Never enable outside dev.
  AUTH_DISABLED: z
    .string()
    .default('false')
    .transform((v) => v === 'true' || v === '1'),

  XP_TICK_SECONDS: z.coerce.number().min(1).default(60),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  // ── Transcription (Part 1: capture + store) ─────────────
  // Off by default. When true the bot records each speaker's audio (during an event /
  // manual capture) to AUDIO_ROOT and enqueues a transcript_jobs row for a separate
  // Whisper worker to pick up. No effect on XP.
  TRANSCRIPTS_ENABLED: z
    .string()
    .default('false')
    .transform((v) => v === 'true' || v === '1'),
  // Where captured WAVs land. In Docker point this at a mounted volume (e.g. /data/audio).
  AUDIO_ROOT: z.string().default('./data/audio'),
})

/**
 * Parsed lazily so tooling (e.g. drizzle-kit) that only needs DATABASE_URL doesn't
 * crash on a missing DISCORD_TOKEN. Access via `env`.
 */
function load(): z.infer<typeof schema> {
  const parsed = schema.safeParse(process.env)
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n')
    throw new Error(`Invalid environment variables:\n${issues}`)
  }
  return parsed.data
}

export type Env = z.infer<typeof schema>
export const env: Env = load()
