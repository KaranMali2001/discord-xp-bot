import { env } from '@xp/core'
import { apiLogger } from './logger'

/** What changed: guild config/events/channel-rules ('rules') or the announcement schedule. */
type InvalidateWhat = 'rules' | 'announcements'

/**
 * Tell the bot to refresh in-memory state after a write (§2.1): drop a guild's cached
 * config/events/channel-rules snapshot ('rules'), or re-read the earliest-pending announcement
 * time ('announcements'). Fire-and-forget by design: the bot's periodic backstop re-sync
 * guarantees eventual consistency, so a failed ping is logged at warn and swallowed — it must
 * never fail the user's write. Disabled when BOT_INTERNAL_URL is blank (backstop-only mode).
 */
export function invalidateBotCache(guildId: string, what: InvalidateWhat = 'rules'): void {
  const base = env.BOT_INTERNAL_URL
  if (!base) return

  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (env.CACHE_INVALIDATE_SECRET) headers['x-cache-secret'] = env.CACHE_INVALIDATE_SECRET

  // AbortSignal.timeout keeps a wedged bot from holding the request open.
  void fetch(`${base.replace(/\/$/, '')}/cache/invalidate`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ what, guildId }),
    signal: AbortSignal.timeout(2000),
  })
    .then((res) => {
      if (!res.ok) {
        apiLogger.warn({ guildId, status: res.status }, 'bot cache invalidate returned non-2xx')
      }
    })
    .catch((err) => {
      apiLogger.warn(
        { guildId, err: err instanceof Error ? err.message : String(err) },
        'bot cache invalidate failed (backstop will cover it)',
      )
    })
}
