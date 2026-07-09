import type { FastifyInstance } from 'fastify'
import { adminsController } from '../controllers/admins.controller'
import { requireManageParam } from '../middleware/auth'

interface GuildParams {
  guildId: string
}
interface UserParams extends GuildParams {
  userId: string
}

export async function adminsRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireManageParam)

  app.get<{ Params: GuildParams }>('/guilds/:guildId/admins', async (request) => {
    return adminsController.list(request.params.guildId)
  })

  app.post<{ Params: GuildParams }>('/guilds/:guildId/admins', async (request) => {
    return adminsController.add(request.params.guildId, request.body)
  })

  app.delete<{ Params: UserParams }>('/guilds/:guildId/admins/:userId', async (request) => {
    return adminsController.remove(request.params.guildId, request.params.userId)
  })
}
