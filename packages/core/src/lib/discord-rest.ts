import { env } from '../env'

/**
 * Minimal Discord REST client (bot token) shared by every process. Per ADR 0001,
 * role mutation and announcements go through here — even inside the bot — so there is
 * one implementation of "touch Discord", not two.
 */
const API = 'https://discord.com/api/v10'

export class DiscordError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
    this.name = 'DiscordError'
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      authorization: `Bot ${env.DISCORD_TOKEN}`,
      ...(body != null ? { 'content-type': 'application/json' } : {}),
    },
    body: body != null ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    throw new DiscordError(res.status, `Discord ${method} ${path} failed (${res.status})`)
  }
  // 204 No Content (role add/remove) has no body.
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

export interface DiscordRole {
  id: string
  name: string
  color: number
  position: number
  managed: boolean
}

interface RawRole extends DiscordRole {
  managed: boolean
}

interface RawMember {
  roles: string[]
  nick: string | null
  user: { id: string; username: string; global_name: string | null }
}

export interface DiscordMember {
  id: string
  username: string
  displayName: string
}

export const discordRest = {
  /** All roles in a guild (includes @everyone + managed — callers filter). */
  async roles(guildId: string): Promise<DiscordRole[]> {
    const raw = await request<RawRole[]>('GET', `/guilds/${guildId}/roles`)
    return raw.map((r) => ({
      id: r.id,
      name: r.name,
      color: r.color,
      position: r.position,
      managed: r.managed,
    }))
  },

  /** Role ids a member currently holds ([] if the member isn't in the guild). */
  async memberRoleIds(guildId: string, userId: string): Promise<string[]> {
    try {
      const m = await request<RawMember>('GET', `/guilds/${guildId}/members/${userId}`)
      return m.roles
    } catch (err) {
      if (err instanceof DiscordError && err.status === 404) return []
      throw err
    }
  },

  /** A single guild member's identity, or null if they aren't in the guild. */
  async member(guildId: string, userId: string): Promise<DiscordMember | null> {
    try {
      const m = await request<RawMember>('GET', `/guilds/${guildId}/members/${userId}`)
      return {
        id: m.user.id,
        username: m.user.username,
        displayName: m.nick ?? m.user.global_name ?? m.user.username,
      }
    } catch (err) {
      if (err instanceof DiscordError && err.status === 404) return null
      throw err
    }
  },

  addRole(guildId: string, userId: string, roleId: string): Promise<void> {
    return request('PUT', `/guilds/${guildId}/members/${userId}/roles/${roleId}`)
  },

  removeRole(guildId: string, userId: string, roleId: string): Promise<void> {
    return request('DELETE', `/guilds/${guildId}/members/${userId}/roles/${roleId}`)
  },

  /** Create a role. `color` is a Discord integer colour; `hoist` shows it separately. */
  createRole(
    guildId: string,
    opts: { name: string; color?: number; hoist?: boolean },
  ): Promise<DiscordRole> {
    return request<DiscordRole>('POST', `/guilds/${guildId}/roles`, {
      name: opts.name,
      color: opts.color ?? 0,
      hoist: opts.hoist ?? true,
      mentionable: false,
    })
  },

  /**
   * Post a message to a channel. By default only user mentions ping (matches the
   * level-up announcer). Pass `allowedMentions` to control exactly who is pinged —
   * announcements use explicit user/role lists so free-text `@everyone` can't leak.
   */
  sendMessage(
    channelId: string,
    content: string,
    opts?: { allowedMentions?: Record<string, unknown> },
  ): Promise<unknown> {
    return request('POST', `/channels/${channelId}/messages`, {
      content,
      allowed_mentions: opts?.allowedMentions ?? { parse: ['users'] },
    })
  },

  /** Post a raw message payload (embeds/components), returning at least its id. */
  createMessage(channelId: string, body: Record<string, unknown>): Promise<{ id: string }> {
    return request<{ id: string }>('POST', `/channels/${channelId}/messages`, body)
  },

  /** Best-effort delete (used to replace a stale ticket panel). */
  deleteMessage(channelId: string, messageId: string): Promise<void> {
    return request('DELETE', `/channels/${channelId}/messages/${messageId}`)
  },

  /**
   * Create/replace a channel permission overwrite for a role (`type: 0`) or member
   * (`type: 1`). `allow`/`deny` are bitfield strings. Requires the bot to hold Manage
   * Roles + the permissions it grants. See https://discord.com/developers permissions.
   */
  setChannelPermission(
    channelId: string,
    overwriteId: string,
    opts: { allow?: bigint; deny?: bigint; type: 0 | 1 },
  ): Promise<void> {
    return request('PUT', `/channels/${channelId}/permissions/${overwriteId}`, {
      allow: (opts.allow ?? 0n).toString(),
      deny: (opts.deny ?? 0n).toString(),
      type: opts.type,
    })
  },
}
