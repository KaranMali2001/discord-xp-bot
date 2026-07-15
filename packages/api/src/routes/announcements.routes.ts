import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { announcementsController } from '../controllers/announcements.controller'
import { getSession } from '../lib/session'
import { parse } from '../lib/validate'
import { requireManageParam } from '../middleware/auth'

interface GuildParams {
  guildId: string
}
interface IdParams extends GuildParams {
  id: string
}

const idParam = z.coerce.number().int().positive()

/** Post now or schedule announcements to a channel from the dashboard. Manage-guild gated. */
export async function announcementsRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireManageParam)

  app.post<{ Params: GuildParams }>('/guilds/:guildId/announcements', async (request) => {
    return announcementsController.send(request.body)
  })

  app.get<{ Params: GuildParams }>('/guilds/:guildId/scheduled-announcements', async (request) => {
    return announcementsController.listScheduled(request.params.guildId)
  })

  app.post<{ Params: GuildParams }>('/guilds/:guildId/scheduled-announcements', async (request) => {
    const createdBy = getSession(request)?.userId ?? 'dashboard'
    return announcementsController.schedule(request.params.guildId, createdBy, request.body)
  })

  app.delete<{ Params: IdParams }>(
    '/guilds/:guildId/scheduled-announcements/:id',
    async (request) => {
      const id = parse(idParam, request.params.id)
      return announcementsController.cancelScheduled(request.params.guildId, id)
    },
  )
}
