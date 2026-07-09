import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { levelRewardsController } from '../controllers/level-rewards.controller'
import { parse } from '../lib/validate'
import { requireManageParam } from '../middleware/auth'

interface GuildParams {
  guildId: string
}
interface LevelParams extends GuildParams {
  level: string
}

const levelParam = z.coerce.number().int().min(1).max(1000)

export async function levelRewardsRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireManageParam)

  app.get<{ Params: GuildParams }>('/guilds/:guildId/level-rewards', async (request) => {
    return levelRewardsController.list(request.params.guildId)
  })

  app.put<{ Params: GuildParams }>('/guilds/:guildId/level-rewards', async (request) => {
    return levelRewardsController.put(request.params.guildId, request.body)
  })

  app.delete<{ Params: LevelParams }>('/guilds/:guildId/level-rewards/:level', async (request) => {
    const level = parse(levelParam, request.params.level)
    return levelRewardsController.remove(request.params.guildId, level)
  })
}
