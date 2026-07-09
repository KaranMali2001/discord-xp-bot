import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { discordController } from '../controllers/discord.controller'
import { DiscordError } from '../lib/discord'
import { parse } from '../lib/validate'

interface GuildParams {
  guildId: string
}

const membersQuery = z.object({
  query: z.string().trim().min(1).optional(),
})

/**
 * Read-only Discord metadata used to populate dashboard pickers. Public reads
 * (like config/leaderboard) — no data is mutated. A missing privileged intent
 * surfaces as a 502 with a hint rather than a raw stack.
 */
export async function discordRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Params: GuildParams }>('/guilds/:guildId/discord/channels', async (request) => {
    return discordController.channels(request.params.guildId)
  })

  app.get<{ Params: GuildParams }>(
    '/guilds/:guildId/discord/members',
    async (request, reply) => {
      const { query } = parse(membersQuery, request.query)
      try {
        return await discordController.members(request.params.guildId, query)
      } catch (err) {
        if (err instanceof DiscordError && err.status === 403) {
          return reply.code(502).send({
            error:
              'Cannot list members — enable the "Server Members Intent" for the bot in the Discord Developer Portal.',
          })
        }
        throw err
      }
    },
  )
}
