import { xpService } from '@xp/core'
import type { FastifyInstance } from 'fastify'

interface GuildParams {
  guildId: string
}

/** Current top-of-board snapshot, serialised for the socket. */
function snapshot(guildId: string): string {
  return JSON.stringify({
    entries: xpService.leaderboard(guildId, 25, 0),
    total: xpService.count(guildId),
  })
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

      socket.send(snapshot(guildId))

      const interval = setInterval(() => {
        socket.send(snapshot(guildId))
      }, 5000)

      socket.on('close', () => {
        clearInterval(interval)
      })
    },
  )
}
