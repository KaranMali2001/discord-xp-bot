import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { eventsController } from '../controllers/events.controller'
import { parse } from '../lib/validate'
import { requireManageParam } from '../middleware/auth'

interface GuildParams {
  guildId: string
}
interface EventParams extends GuildParams {
  id: string
}

// Route params arrive as strings — coerce + validate a positive integer id.
const idParam = z.coerce.number().int().positive()

export async function eventsRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireManageParam)

  app.get<{ Params: GuildParams }>('/guilds/:guildId/events', async (request) => {
    return eventsController.list(request.params.guildId)
  })

  app.post<{ Params: GuildParams }>('/guilds/:guildId/events', async (request) => {
    return eventsController.create(request.params.guildId, request.body)
  })

  app.get<{ Params: EventParams }>('/guilds/:guildId/events/:id/attendance', async (request) => {
    const id = parse(idParam, request.params.id)
    return eventsController.attendance(request.params.guildId, id)
  })

  app.patch<{ Params: EventParams }>('/guilds/:guildId/events/:id', async (request) => {
    const id = parse(idParam, request.params.id)
    return eventsController.update(request.params.guildId, id, request.body)
  })

  app.delete<{ Params: EventParams }>('/guilds/:guildId/events/:id', async (request) => {
    const id = parse(idParam, request.params.id)
    return eventsController.remove(request.params.guildId, id)
  })
}
