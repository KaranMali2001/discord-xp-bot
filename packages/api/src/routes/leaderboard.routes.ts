import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { leaderboardController } from '../controllers/leaderboard.controller'
import { parse } from '../lib/validate'

interface GuildParams {
  guildId: string
}

// Query values arrive as strings; coerce with sane bounds + defaults.
const query = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).default(0),
})

export async function leaderboardRoutes(app: FastifyInstance): Promise<void> {
  // Public read — no auth guard.
  app.get<{ Params: GuildParams }>('/guilds/:guildId/leaderboard', async (request) => {
    const { limit, offset } = parse(query, request.query)
    return leaderboardController.get(request.params.guildId, limit, offset)
  })
}
