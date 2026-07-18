import cookie from '@fastify/cookie'
import cors from '@fastify/cors'
import websocket from '@fastify/websocket'
import { env } from '@xp/core'
import Fastify, { type FastifyBaseLogger, type FastifyInstance } from 'fastify'
import { apiLogger } from './lib/logger'
import { ValidationError } from './lib/validate'
import { registerAuth } from './middleware/auth'
import { adminsRoutes } from './routes/admins.routes'
import { announcementsRoutes } from './routes/announcements.routes'
import { badgesRoutes } from './routes/badges.routes'
import { channelRulesRoutes } from './routes/channel-rules.routes'
import { configRoutes } from './routes/config.routes'
import { discordRoutes } from './routes/discord.routes'
import { eventsRoutes } from './routes/events.routes'
import { leaderboardRoutes } from './routes/leaderboard.routes'
import { levelRewardsRoutes } from './routes/level-rewards.routes'
import { membersRoutes } from './routes/members.routes'
import { ticketsRoutes } from './routes/tickets.routes'
import { wsRoutes } from './routes/ws.routes'

export async function buildApp(): Promise<FastifyInstance> {
  // Cast keeps the app typed with Fastify's default FastifyBaseLogger — passing a raw pino
  // instance would otherwise re-type the whole instance and clash with the route modules.
  const app = Fastify({ loggerInstance: apiLogger as unknown as FastifyBaseLogger })

  // Surface zod validation failures as a clean 400 with flattened issues.
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ValidationError) {
      return reply.code(400).send({ error: error.message, issues: error.issues })
    }
    const err = error as { statusCode?: number; message?: string }
    const status = err.statusCode ?? 500
    if (status >= 500) app.log.error(error)
    return reply.code(status).send({ error: err.message ?? 'Internal Server Error' })
  })

  await app.register(cors, { origin: env.WEB_URL, credentials: true })
  await app.register(cookie, { secret: env.SESSION_SECRET })
  await app.register(websocket)

  // OAuth + session endpoints live at the root (Discord redirect_uri).
  registerAuth(app)

  // Realtime socket at /ws/...
  await app.register(wsRoutes)

  // REST API under /api.
  await app.register(
    async (api) => {
      await api.register(configRoutes)
      await api.register(channelRulesRoutes)
      await api.register(eventsRoutes)
      await api.register(levelRewardsRoutes)
      await api.register(badgesRoutes)
      await api.register(leaderboardRoutes)
      await api.register(adminsRoutes)
      await api.register(discordRoutes)
      await api.register(membersRoutes)
      await api.register(announcementsRoutes)
      await api.register(ticketsRoutes)
    },
    { prefix: '/api' },
  )

  return app
}
