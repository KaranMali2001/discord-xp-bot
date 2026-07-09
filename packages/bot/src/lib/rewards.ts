import { type GrantResult, badgesService, rulesDao, rulesService } from '@xp/core'
import type { Client, Guild, GuildMember, SendableChannels } from 'discord.js'
import { log } from './log'

/** Resolve where to announce: the configured level-up channel, else the fallback. */
async function announceChannel(
  guild: Guild,
  fallbackChannelId?: string,
): Promise<SendableChannels | null> {
  const cfg = rulesService.getConfig(guild.id)
  const id = cfg.levelUpChannelId ?? fallbackChannelId
  if (!id) return null
  const ch = guild.channels.cache.get(id) ?? (await guild.channels.fetch(id).catch(() => null))
  return ch?.isSendable() ? ch : null
}

/** Grant any level-role rewards the member has earned but doesn't yet hold. */
async function syncLevelRoles(member: GuildMember, level: number): Promise<void> {
  const rewards = rulesDao.listLevelRewards(member.guild.id).filter((r) => r.level <= level)
  for (const r of rewards) {
    if (!member.roles.cache.has(r.roleId)) {
      await member.roles.add(r.roleId).catch(() => {})
    }
  }
}

/**
 * Called after every XP grant (chat or voice). Handles level-up side effects
 * (roles + announcement) and badge evaluation/announcement. Best-effort: never throws.
 */
export async function processGrant(
  client: Client,
  guildId: string,
  userId: string,
  result: GrantResult,
  fallbackChannelId?: string,
): Promise<void> {
  const guild = client.guilds.cache.get(guildId)
  if (!guild) return
  const member = await guild.members.fetch(userId).catch(() => null)

  if (result.leveledUp && member) {
    log.info('level', `${member.displayName} → level ${result.newLevel}`)
    await syncLevelRoles(member, result.newLevel)
    const cfg = rulesService.getConfig(guildId)
    const ch = await announceChannel(guild, fallbackChannelId)
    if (ch) {
      const text = cfg.levelUpMessage
        .replaceAll('{user}', `<@${userId}>`)
        .replaceAll('{level}', String(result.newLevel))
      await ch.send(text).catch(() => {})
    }
  }

  // Badges can be earned from any activity (level, messages, voice/speaking minutes, Fridays).
  const newBadges = badgesService.evaluate(guildId, userId)
  if (newBadges.length > 0) {
    log.info(
      'badge',
      `${member?.displayName ?? userId} earned: ${newBadges.map((b) => b.key).join(', ')}`,
    )
    const ch = await announceChannel(guild, fallbackChannelId)
    if (ch) {
      for (const b of newBadges) {
        await ch.send(`${b.emoji} <@${userId}> earned the **${b.name}** badge!`).catch(() => {})
      }
    }
  }
}
