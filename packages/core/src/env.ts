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

  // Local dev: a local postgres:// URL. Production: a Neon POOLED postgres:// URL (SSL is
  // enforced in code for any remote host — see util/db-url.ts). (Legacy Turso/libsql dropped.)
  DATABASE_URL: z.string().default('postgres://postgres:postgres@localhost:5432/xp'),
  // Direct (non-pooled) Postgres URL for drizzle-kit migrations — pgBouncer drops the
  // sessions the migrator needs. Falls back to DATABASE_URL when unset.
  DATABASE_DIRECT_URL: z.string().default(''),
  // Turso auth token — required only when DATABASE_URL is a libsql:// URL. Dropped at cutover.
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
  // When set, persist logs to a file under this dir (a host bind-mount in Docker) so they
  // survive container removal / daemon crashes. Unset (local dev) → stdout only (§2.3).
  LOG_DIR: z.string().optional(),

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

  // ── Config/events cache invalidation (§2.1) ───────────────
  // The bot holds an in-memory read cache of guild config + events so it issues ZERO DB
  // queries when idle (Neon scales to zero). The API (the writer) pings the bot after every
  // config/event write so the cache refreshes immediately; a 30-min backstop reload covers a
  // ping lost while the bot was restarting.
  //   Bot: binds a tiny loopback HTTP listener at CACHE_INVALIDATE_HOST:CACHE_INVALIDATE_PORT.
  //   API: POSTs to BOT_INTERNAL_URL/cache/invalidate with the shared secret header.
  // The listener is loopback-only by default and secret-gated; leave the secret blank locally
  // (single-machine) — set it in prod so a stray same-host process can't poke the cache.
  CACHE_INVALIDATE_HOST: z.string().default('127.0.0.1'),
  CACHE_INVALIDATE_PORT: z.coerce.number().default(8091),
  CACHE_INVALIDATE_SECRET: z.string().default(''),
  // Where the API reaches the bot's invalidate listener. Blank ⇒ disabled (backstop-only).
  BOT_INTERNAL_URL: z.string().default('http://127.0.0.1:8091'),

  // ── Cloudinary (ticket-attachment image storage; §2.2) ─────
  // Off-DB object storage for ticket images. Required only when ticket image capture runs:
  // the bot uploads (server-side signed) and the API mints short-lived signed delivery URLs.
  CLOUDINARY_CLOUD_NAME: z.string().default(''),
  CLOUDINARY_API_KEY: z.string().default(''),
  CLOUDINARY_API_SECRET: z.string().default(''),
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
