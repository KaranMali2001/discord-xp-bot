import type { FastifyInstance } from 'fastify'
import { channelRulesController } from '../controllers/channel-rules.controller'
import { requireManageParam } from '../middleware/auth'

interface GuildParams {
  guildId: string
}
interface ChannelParams extends GuildParams {
  channelId: string
}

export async function channelRulesRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireManageParam)

  app.get<{ Params: GuildParams }>('/guilds/:guildId/channel-rules', async (request) => {
    return channelRulesController.list(request.params.guildId)
  })

  app.put<{ Params: GuildParams }>('/guilds/:guildId/channel-rules', async (request) => {
    return channelRulesController.put(request.params.guildId, request.body)
  })

  app.delete<{ Params: ChannelParams }>(
    '/guilds/:guildId/channel-rules/:channelId',
    async (request) => {
      return channelRulesController.remove(request.params.guildId, request.params.channelId)
    },
  )
}
