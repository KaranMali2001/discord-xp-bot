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
 * Realtime leaderboard: pushes a snapshot on connect and every 5s thereafter.
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

      const interval = setInterval(push, 5000)

      socket.on('close', () => {
        clearInterval(interval)
      })
    },
  )
}
