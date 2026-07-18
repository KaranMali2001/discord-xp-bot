import { discordRest } from '../../lib/discord-rest'
import type { Badge } from '../badges/badges.dao'
import { badgesService } from '../badges/badges.service'
import { rulesDao } from '../rules/rules.dao'
import { rulesService } from '../rules/rules.service'
import { xpService } from '../xp/xp.service'
import { reconcileDecision } from './level-roles.service'

export interface ReconcileResult {
  level: number
  previousLevel: number
  leveledUp: boolean
  /** A tier reward role that was newly *added* this reconcile (null if none). */
  newTierRoleId: string | null
  /** Badges newly earned during this reconcile. */
  newBadges: Badge[]
}

/**
 * Bring a member's derived state (level role + badges) into sync with their current XP,
 * mutating Discord over REST. Pure decision lives in level-roles.service; this is the
 * one place both the bot (live grants) and the api (XP Boosts) call. Best-effort on the
 * Discord side — a failed role write is reported by the caller, never thrown here.
 */
export async function reconcileMember(
  guildId: string,
  userId: string,
  previousLevel: number,
): Promise<ReconcileResult | null> {
  const member = await xpService.get(guildId, userId)
  if (!member) return null

  // A single-tier role can only change when the level changes. Most grants (every
  // message/voice tick) don't level anyone up, so skip the Discord round-trip then —
  // badges below are cheap DB reads and always run.
  let newTierRoleId: string | null = null
  if (member.level !== previousLevel) {
    const rewards = await rulesDao.listLevelRewards(guildId)
    if (rewards.length > 0) {
      const currentRoleIds = await discordRest.memberRoleIds(guildId, userId)
      const diff = reconcileDecision(currentRoleIds, member.level, rewards)

      for (const roleId of diff.remove) {
        await discordRest.removeRole(guildId, userId, roleId).catch(() => {})
      }
      for (const roleId of diff.add) {
        await discordRest.addRole(guildId, userId, roleId).catch(() => {})
      }
      newTierRoleId =
        diff.targetRoleId && diff.add.includes(diff.targetRoleId) ? diff.targetRoleId : null
    }
  }

  const newBadges = await badgesService.evaluate(guildId, userId)

  return {
    level: member.level,
    previousLevel,
    leveledUp: member.level > previousLevel,
    newTierRoleId,
    newBadges,
  }
}

/**
 * Post the announcement(s) for a reconcile to the guild's configured channel. Separate
 * from reconcileMember by design (state is always synced; messaging is a UX layer that
 * only fires on a threshold crossing). `fallbackChannelId` lets live grants announce in
 * the originating channel when no level-up channel is configured; XP Boosts pass none.
 */
export async function announceReconcile(
  guildId: string,
  userId: string,
  result: ReconcileResult,
  opts: { fallbackChannelId?: string } = {},
): Promise<void> {
  const cfg = await rulesService.getConfig(guildId)
  const channelId = cfg.levelUpChannelId ?? opts.fallbackChannelId
  if (!channelId) return

  const mention = `<@${userId}>`
  const fill = (t: string, role?: string) =>
    t
      .replaceAll('{user}', mention)
      .replaceAll('{level}', String(result.level))
      .replaceAll('{role}', role ?? '')

  // A level-up announces once: the tier message supersedes the plain level-up line.
  if (result.leveledUp) {
    if (result.newTierRoleId) {
      const reward = (await rulesDao.listLevelRewards(guildId)).find(
        (r) => r.roleId === result.newTierRoleId,
      )
      const roleName = await roleNameFor(guildId, result.newTierRoleId)
      await discordRest
        .sendMessage(channelId, fill(reward?.message ?? cfg.tierUpMessage, roleName))
        .catch(() => {})
    } else {
      await discordRest.sendMessage(channelId, fill(cfg.levelUpMessage)).catch(() => {})
    }
  }

  for (const b of result.newBadges) {
    await discordRest
      .sendMessage(channelId, `${b.emoji} ${mention} earned the **${b.name}** badge!`)
      .catch(() => {})
  }
}

async function roleNameFor(guildId: string, roleId: string): Promise<string> {
  try {
    const roles = await discordRest.roles(guildId)
    return roles.find((r) => r.id === roleId)?.name ?? 'a new role'
  } catch {
    return 'a new role'
  }
}
