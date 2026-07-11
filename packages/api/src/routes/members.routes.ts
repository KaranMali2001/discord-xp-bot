import type { FastifyInstance } from 'fastify'
import { membersController } from '../controllers/members.controller'
import { requireManageParam } from '../middleware/auth'

interface MemberParams {
  guildId: string
  userId: string
}

export async function membersRoutes(app: FastifyInstance): Promise<void> {
  // XP Boost — an admin action; always guarded.
  app.post<{ Params: MemberParams }>(
    '/guilds/:guildId/members/:userId/xp',
    { preHandler: requireManageParam },
    async (request) => {
      return membersController.boostXp(request.params.guildId, request.params.userId, request.body)
    },
  )
}
