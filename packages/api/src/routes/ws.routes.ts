import { xpService } from '@xp/core'
import type { FastifyInstance } from 'fastify'

interface GuildParams {
  guildId: string
}

/** Current top-of-board snapshot, serialised for the socket. */
async function snapshot(guildId: string): Promise<string> {
  const [entries, total] = await Promise.all([
    xpService.leaderboard(guildId, 25, 0),
    xpService.count(guildId),
  ])
  return JSON.stringify({ entries, total })
}

/**
 * Snapshot cadence, ms. Each push runs TWO Postgres queries (leaderboard + count) per connected
 * socket, so a short interval keeps Neon awake for the life of every connection. 30s is live
 * enough for a leaderboard while letting the DB scale to zero when nobody is connected.
 */
const PUSH_MS = 30_000

/**
 * Realtime leaderboard: pushes a snapshot on connect and every PUSH_MS thereafter.
 * No pub/sub — a plain poll is enough to demonstrate the socket wiring, and the
 * interval is cleared on close so we don't leak timers.
 */
export async function wsRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Params: GuildParams }>(
    '/ws/guilds/:guildId/leaderboard',
    { websocket: true },
    (socket, request) => {
      const { guildId } = request.params

      const push = () => {
        void snapshot(guildId)
          .then((s) => socket.send(s))
          .catch(() => {})
      }
      push()

      const interval = setInterval(push, PUSH_MS)

      socket.on('close', () => {
        clearInterval(interval)
      })
    },
  )
}
