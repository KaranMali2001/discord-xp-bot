import type { FastifyInstance } from 'fastify'
import { configController } from '../controllers/config.controller'
import { requireManageParam } from '../middleware/auth'

interface GuildParams {
  guildId: string
}

export async function configRoutes(app: FastifyInstance): Promise<void> {
  // Public read.
  app.get<{ Params: GuildParams }>('/guilds/:guildId/config', async (request) => {
    return configController.get(request.params.guildId)
  })

  app.put<{ Params: GuildParams }>(
    '/guilds/:guildId/config',
    { preHandler: requireManageParam },
    async (request) => {
      return configController.put(request.params.guildId, request.body)
    },
  )
}
