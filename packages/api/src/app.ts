import cookie from '@fastify/cookie'
import cors from '@fastify/cors'
import websocket from '@fastify/websocket'
import { env } from '@xp/core'
import Fastify, { type FastifyInstance } from 'fastify'
import { ValidationError } from './lib/validate'
import { registerAuth } from './middleware/auth'
import { adminsRoutes } from './routes/admins.routes'
import { badgesRoutes } from './routes/badges.routes'
import { channelRulesRoutes } from './routes/channel-rules.routes'
import { configRoutes } from './routes/config.routes'
import { discordRoutes } from './routes/discord.routes'
import { eventsRoutes } from './routes/events.routes'
import { leaderboardRoutes } from './routes/leaderboard.routes'
import { levelRewardsRoutes } from './routes/level-rewards.routes'
import { wsRoutes } from './routes/ws.routes'

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: { level: env.LOG_LEVEL } })

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
    },
    { prefix: '/api' },
  )

  return app
}
