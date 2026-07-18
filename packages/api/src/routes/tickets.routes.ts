import type { FastifyInstance } from 'fastify'
import { ticketsController } from '../controllers/tickets.controller'
import { requireManageParam } from '../middleware/auth'

interface GuildParams {
  guildId: string
}

export async function ticketsRoutes(app: FastifyInstance): Promise<void> {
  // Read the current setup (managers only — reveals staff/channel wiring).
  app.get<{ Params: GuildParams }>(
    '/guilds/:guildId/tickets',
    { preHandler: requireManageParam },
    async (request) => {
      return ticketsController.get(request.params.guildId)
    },
  )

  // Save: apply permissions + post panel + persist.
  app.put<{ Params: GuildParams }>(
    '/guilds/:guildId/tickets',
    { preHandler: requireManageParam },
    async (request) => {
      return ticketsController.setup(request.params.guildId, request.body)
    },
  )

  // A ticket's attachments with signed (private) Cloudinary delivery URLs for the dashboard.
  app.get<{ Params: GuildParams & { ticketId: string } }>(
    '/guilds/:guildId/tickets/:ticketId/attachments',
    { preHandler: requireManageParam },
    async (request) => {
      return ticketsController.listAttachments(
        request.params.guildId,
        Number(request.params.ticketId),
      )
    },
  )
}
