import { authService, env } from '@xp/core'
import type { FastifyInstance, FastifyReply, FastifyRequest, preHandlerHookHandler } from 'fastify'
import { z } from 'zod'
import { clearSession, getSession, setSession } from '../lib/session'
import { parse } from '../lib/validate'

const DISCORD_API = 'https://discord.com/api'
/** MANAGE_GUILD permission bit. */
const MANAGE_GUILD = 0x20n

/** No API_URL in env — derive it from the port the server listens on. */
function apiUrl(): string {
  return `http://localhost:${env.API_PORT}`
}

function redirectUri(): string {
  return `${apiUrl()}/auth/callback`
}

interface DiscordUser {
  id: string
  username: string
}

interface DiscordGuild {
  id: string
  permissions: string
}

/** Guild ids where the user holds MANAGE_GUILD. */
function computeManageGuildIds(guilds: DiscordGuild[]): string[] {
  return guilds
    .filter((g) => {
      const perms = BigInt(g.permissions)
      return (perms & MANAGE_GUILD) === MANAGE_GUILD
    })
    .map((g) => g.id)
}

const callbackQuery = z.object({ code: z.string().min(1) })
const devLoginBody = z.object({
  userId: z.string().min(1),
  username: z.string().min(1),
  guildId: z.string().min(1),
})

function assertCanManage(request: FastifyRequest, reply: FastifyReply, guildId: string): boolean {
  const session = getSession(request)
  if (!session) {
    reply.code(401).send({ error: 'Not authenticated' })
    return false
  }
  const hasManageGuild = session.manageGuildIds.includes(guildId)
  if (!authService.canManage(guildId, session.userId, hasManageGuild)) {
    reply.code(403).send({ error: 'Not allowed to manage this guild' })
    return false
  }
  return true
}

/**
 * preHandler factory: 401 without a session, 403 unless the session may manage
 * `guildId` (Discord MANAGE_GUILD or the explicit allowlist, decided in core).
 */
export function requireManage(guildId: string): preHandlerHookHandler {
  return async (request, reply) => {
    assertCanManage(request, reply, guildId)
  }
}

/**
 * preHandler for routes that carry `:guildId` in params — the common case.
 * Reads the guild id off the request so callers don't have to wire a factory.
 */
export const requireManageParam: preHandlerHookHandler = async (request, reply) => {
  const guildId = (request.params as { guildId?: string }).guildId
  if (!guildId) {
    return reply.code(400).send({ error: 'Missing guildId' })
  }
  assertCanManage(request, reply, guildId)
}

export function registerAuth(app: FastifyInstance): void {
  // Step 1: send the user to Discord to authorise.
  app.get('/auth/login', async (_request, reply) => {
    const url = new URL(`${DISCORD_API}/oauth2/authorize`)
    url.searchParams.set('client_id', env.DISCORD_CLIENT_ID)
    url.searchParams.set('redirect_uri', redirectUri())
    url.searchParams.set('response_type', 'code')
    url.searchParams.set('scope', 'identify guilds')
    return reply.redirect(url.toString())
  })

  // Step 2: exchange the code, load identity + guilds, set the session.
  app.get('/auth/callback', async (request, reply) => {
    const { code } = parse(callbackQuery, request.query)

    const tokenRes = await fetch(`${DISCORD_API}/oauth2/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: env.DISCORD_CLIENT_ID,
        client_secret: env.DISCORD_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri(),
      }),
    })
    if (!tokenRes.ok) {
      return reply.code(502).send({ error: 'Failed to exchange OAuth code' })
    }
    const token = (await tokenRes.json()) as { access_token: string }
    const authHeader = { authorization: `Bearer ${token.access_token}` }

    const [userRes, guildsRes] = await Promise.all([
      fetch(`${DISCORD_API}/users/@me`, { headers: authHeader }),
      fetch(`${DISCORD_API}/users/@me/guilds`, { headers: authHeader }),
    ])
    if (!userRes.ok || !guildsRes.ok) {
      return reply.code(502).send({ error: 'Failed to load Discord identity' })
    }

    const user = (await userRes.json()) as DiscordUser
    const guilds = (await guildsRes.json()) as DiscordGuild[]
    const manageGuildIds = computeManageGuildIds(guilds)

    setSession(reply, {
      userId: user.id,
      username: user.username,
      guildId: manageGuildIds[0] ?? env.DISCORD_GUILD_ID,
      manageGuildIds,
    })
    return reply.redirect(env.WEB_URL)
  })

  // Current session, or 401.
  app.get('/auth/me', async (request, reply) => {
    const session = getSession(request)
    if (!session) return reply.code(401).send({ error: 'Not authenticated' })
    return session
  })

  // Clear the cookie.
  app.post('/auth/logout', async (_request, reply) => {
    clearSession(reply)
    return { ok: true }
  })

  // Local dev bypass — only when no OAuth secret is configured.
  if (!env.DISCORD_CLIENT_SECRET) {
    app.post('/auth/dev-login', async (request, reply) => {
      const { userId, username, guildId } = parse(devLoginBody, request.body)
      setSession(reply, { userId, username, guildId, manageGuildIds: [guildId] })
      return { ok: true, userId, username, guildId }
    })
  }
}
