import { env } from '@xp/core'

/**
 * Thin Discord REST client (bot token) for read-only guild metadata the dashboard
 * needs to render pickers — channels and members. OAuth/session lives in middleware.
 */
const DISCORD_API = 'https://discord.com/api/v10'

/** Raised when Discord rejects a request; carries the upstream status. */
export class DiscordError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
    this.name = 'DiscordError'
  }
}

async function discordGet<T>(path: string): Promise<T> {
  const res = await fetch(`${DISCORD_API}${path}`, {
    headers: { authorization: `Bot ${env.DISCORD_TOKEN}` },
  })
  if (!res.ok) {
    // 403 usually means the bot lacks a privileged intent (e.g. GUILD_MEMBERS).
    throw new DiscordError(res.status, `Discord request failed (${res.status})`)
  }
  return (await res.json()) as T
}

// ── channels ──────────────────────────────────────────────────────────

// https://discord.com/developers/docs/resources/channel#channel-object-channel-types
const TEXT_TYPES = new Set([0, 5, 15]) // text, announcement, forum
const VOICE_TYPES = new Set([2, 13]) // voice, stage

interface RawChannel {
  id: string
  name: string
  type: number
  position: number
}

export interface DiscordChannel {
  id: string
  name: string
  kind: 'text' | 'voice'
}

/** Text + voice channels for a guild, sorted by Discord's own position. */
export async function listChannels(guildId: string): Promise<DiscordChannel[]> {
  const raw = await discordGet<RawChannel[]>(`/guilds/${guildId}/channels`)
  return raw
    .filter((c) => TEXT_TYPES.has(c.type) || VOICE_TYPES.has(c.type))
    .sort((a, b) => a.position - b.position)
    .map((c) => ({
      id: c.id,
      name: c.name,
      kind: TEXT_TYPES.has(c.type) ? 'text' : 'voice',
    }))
}

// ── members ───────────────────────────────────────────────────────────

interface RawMember {
  nick: string | null
  user: { id: string; username: string; global_name: string | null }
}

export interface DiscordMember {
  id: string
  username: string
  displayName: string
}

function toMember(m: RawMember): DiscordMember {
  return {
    id: m.user.id,
    username: m.user.username,
    displayName: m.nick ?? m.user.global_name ?? m.user.username,
  }
}

/**
 * Members for a guild. With a query, uses Discord's prefix search; otherwise
 * returns the first page. Requires the GUILD_MEMBERS privileged intent — a 403
 * bubbles up as a DiscordError the caller maps to a friendly message.
 */
export async function listMembers(guildId: string, query?: string): Promise<DiscordMember[]> {
  const path = query
    ? `/guilds/${guildId}/members/search?limit=25&query=${encodeURIComponent(query)}`
    : `/guilds/${guildId}/members?limit=100`
  const raw = await discordGet<RawMember[]>(path)
  return raw.map(toMember)
}
