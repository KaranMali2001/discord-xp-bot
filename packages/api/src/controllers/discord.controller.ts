import { type DiscordRole, discordRest, env } from '@xp/core'
import { z } from 'zod'
import { listChannels, listMembers } from '../lib/discord'
import { parse } from '../lib/validate'

export interface RoleOption {
  id: string
  name: string
  color: number
  position: number
  /** True if the bot can assign it (below the bot's highest role). */
  assignable: boolean
}

const createRoleBody = z.object({
  name: z.string().min(1).max(100),
  color: z.number().int().min(0).max(0xffffff).optional(),
  hoist: z.boolean().optional(),
})

/** Guild metadata (channels, members, roles) sourced from Discord for the dashboard. */
export const discordController = {
  channels(guildId: string) {
    return listChannels(guildId)
  },

  members(guildId: string, query?: string) {
    return listMembers(guildId, query)
  },

  /** Assignable-aware role list: excludes @everyone + managed, flags hierarchy. */
  async roles(guildId: string): Promise<RoleOption[]> {
    const [all, botRoleIds] = await Promise.all([
      discordRest.roles(guildId),
      discordRest.memberRoleIds(guildId, env.DISCORD_CLIENT_ID),
    ])
    const botTop = Math.max(
      0,
      ...all.filter((r) => botRoleIds.includes(r.id)).map((r) => r.position),
    )
    return all
      .filter((r) => r.id !== guildId && !r.managed) // drop @everyone + integration roles
      .sort((a, b) => b.position - a.position)
      .map((r: DiscordRole) => ({
        id: r.id,
        name: r.name,
        color: r.color,
        position: r.position,
        assignable: r.position < botTop,
      }))
  },

  /** Create a hoisted, coloured tier role (dashboard-creates flow). */
  createRole(guildId: string, body: unknown) {
    const { name, color, hoist } = parse(createRoleBody, body)
    return discordRest.createRole(guildId, { name, color, hoist: hoist ?? true })
  },
}
