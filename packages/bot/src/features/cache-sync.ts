import { timingSafeEqual } from 'node:crypto'
import { createServer, type Server } from 'node:http'
import { env, rulesService } from '@xp/core'
import { log } from '../lib/log'
import { resyncSchedule } from './scheduled-tick'

/**
 * Cross-process cache invalidation (§2.1). The bot holds an in-memory read cache of guild
 * config/events; the API is the writer. After each write the API POSTs here so the bot refreshes
 * that guild immediately ("push for freshness"), and a 30-min backstop clears everything in case
 * a push was lost while the bot was restarting ("slow pull as insurance").
 *
 * Security: the listener binds to CACHE_INVALIDATE_HOST (loopback by default) and, when
 * CACHE_INVALIDATE_SECRET is set, requires it in the `x-cache-secret` header. The bot runs
 * `network_mode: host`, so keeping the bind on loopback + a secret is what keeps this endpoint
 * off-limits to anything but the co-located API.
 */

/** 30-min full-cache reload backstop — catches any invalidate lost during a bot restart. */
const BACKSTOP_MS = 30 * 60 * 1000

/** Constant-time secret compare (avoids length/early-exit leaks); false on any mismatch. */
function secretMatches(expected: string, got: string | string[] | undefined): boolean {
  if (typeof got !== 'string') return false
  const a = Buffer.from(expected)
  const b = Buffer.from(got)
  return a.length === b.length && timingSafeEqual(a, b)
}

function readBody(req: import('node:http').IncomingMessage, limitBytes = 4096): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', (chunk) => {
      data += chunk
      if (data.length > limitBytes) reject(new Error('body too large'))
    })
    req.on('end', () => resolve(data))
    req.on('error', reject)
  })
}

/**
 * Start the invalidate listener + backstop. Returns the HTTP server so the shutdown path can
 * close it. Safe to call once at boot after `rulesService.enableCache()`.
 */
export function startCacheSync(): { server: Server; backstop: NodeJS.Timeout } {
  const secret = env.CACHE_INVALIDATE_SECRET

  const server = createServer((req, res) => {
    void (async () => {
      try {
        if (req.method === 'GET' && req.url === '/health') {
          res.writeHead(200).end('ok')
          return
        }
        if (req.method !== 'POST' || req.url !== '/cache/invalidate') {
          res.writeHead(404).end()
          return
        }
        // A blank configured secret means "no auth" (local single-box dev); otherwise require a
        // constant-time match on the header.
        if (secret && !secretMatches(secret, req.headers['x-cache-secret'])) {
          res.writeHead(401).end()
          return
        }

        const raw = await readBody(req)
        // Invalidation is a signal, never a payload we trust: we only read WHAT changed and WHICH
        // guild, then re-fetch from Postgres, so a malformed/partial body can't corrupt the cache.
        let body: { what?: unknown; guildId?: unknown } = {}
        try {
          if (raw) body = JSON.parse(raw) as typeof body
        } catch {
          body = {}
        }
        const guildId = body.guildId
        if (body.what === 'announcements') {
          // A scheduled announcement was created/cancelled elsewhere — re-read the next fire time.
          void resyncSchedule().catch((e) =>
            log.error('cache', `announcement resync failed: ${e instanceof Error ? e.message : e}`),
          )
          log.debug('cache', 'resynced announcement schedule')
        } else if (typeof guildId === 'string' && guildId.length > 0) {
          rulesService.invalidate(guildId)
          log.debug('cache', `invalidated guild ${guildId}`)
        } else {
          rulesService.invalidateAll()
          log.debug('cache', 'invalidated all guilds')
        }
        res.writeHead(204).end()
      } catch (e) {
        log.warn('cache', `invalidate request failed: ${e instanceof Error ? e.message : e}`)
        if (!res.headersSent) res.writeHead(400).end()
      }
    })()
  })

  server.on('error', (e) => log.error('cache', `invalidate listener error: ${e.message}`))
  server.listen(env.CACHE_INVALIDATE_PORT, env.CACHE_INVALIDATE_HOST, () => {
    log.info(
      'cache',
      `invalidate listener on ${env.CACHE_INVALIDATE_HOST}:${env.CACHE_INVALIDATE_PORT}` +
        (secret ? ' (secret required)' : ' (no secret — local dev)'),
    )
  })

  // Backstop: clear everything every 30 min; the next read lazily reloads from Postgres.
  const backstop = setInterval(() => {
    rulesService.invalidateAll()
    log.debug('cache', 'backstop reload — cleared cache')
  }, BACKSTOP_MS)
  // Don't let the timer keep the process alive on shutdown.
  backstop.unref?.()

  return { server, backstop }
}
