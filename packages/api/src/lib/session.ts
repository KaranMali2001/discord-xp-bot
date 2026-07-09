import type { FastifyReply, FastifyRequest } from 'fastify'

/** The identity we persist in the signed session cookie. */
export interface SessionData {
  userId: string
  username: string
  guildId: string
  manageGuildIds: string[]
}

const COOKIE_NAME = 'xp_session'

const COOKIE_OPTS = {
  path: '/',
  httpOnly: true,
  sameSite: 'lax' as const,
  signed: true,
  maxAge: 60 * 60 * 24 * 7, // 7 days
}

/** Read + verify the signed session cookie, or null if absent/tampered. */
export function getSession(request: FastifyRequest): SessionData | null {
  const raw = request.cookies[COOKIE_NAME]
  if (!raw) return null

  const unsigned = request.unsignCookie(raw)
  if (!unsigned.valid || unsigned.value == null) return null

  try {
    return JSON.parse(unsigned.value) as SessionData
  } catch {
    return null
  }
}

/** Write the signed session cookie. */
export function setSession(reply: FastifyReply, data: SessionData): void {
  reply.setCookie(COOKIE_NAME, JSON.stringify(data), COOKIE_OPTS)
}

/** Remove the session cookie. */
export function clearSession(reply: FastifyReply): void {
  reply.clearCookie(COOKIE_NAME, { path: '/' })
}
