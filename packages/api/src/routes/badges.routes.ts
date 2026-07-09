import type { FastifyInstance } from 'fastify'
import { badgesController } from '../controllers/badges.controller'
import { requireManageParam } from '../middleware/auth'

interface GuildParams {
  guildId: string
}
interface KeyParams extends GuildParams {
  key: string
}

export async function badgesRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireManageParam)

  app.get<{ Params: GuildParams }>('/guilds/:guildId/badges', async (request) => {
    return badgesController.list(request.params.guildId)
  })

  app.put<{ Params: GuildParams }>('/guilds/:guildId/badges', async (request) => {
    return badgesController.put(request.params.guildId, request.body)
  })

  app.delete<{ Params: KeyParams }>('/guilds/:guildId/badges/:key', async (request) => {
    return badgesController.remove(request.params.guildId, request.params.key)
  })
}
