import { nowSec } from '../../util/time'
import { levelFromXp } from '../leveling/leveling.service'
import { rulesService } from '../rules/rules.service'
import { type CounterDelta, type Member, xpDao } from './xp.dao'

export interface GrantResult {
  awarded: number
  member: Member
  oldLevel: number
  newLevel: number
  leveledUp: boolean
}

/** null reasons for a skipped grant — useful for logging/debugging. */
export type SkipReason = 'no_xp_channel' | 'cooldown' | 'zero_multiplier'

export const xpService = {
  /**
   * Core grant path shared by chat + voice. Resolves the effective multiplier for
   * the channel, applies it to `baseAmount`, writes atomically, recomputes level.
   * Returns the attendance event ids so voice can record Friday attendance.
   */
  async grant(
    guildId: string,
    userId: string,
    username: string,
    baseAmount: number,
    channelId: string,
    counters: CounterDelta = {},
    atSec: number = nowSec(),
  ): Promise<{ result: GrantResult; attendanceEventIds: number[] } | { skip: SkipReason }> {
    const { multiplier, noXp, attendanceEventIds } = await rulesService.effectiveMultiplier(
      guildId,
      channelId,
      atSec,
      userId,
    )
    if (noXp) return { skip: 'no_xp_channel' }

    const awarded = Math.round(baseAmount * multiplier)
    const member = await xpDao.ensure(guildId, userId, username)
    if (awarded <= 0) {
      // still persist counters (e.g. voice seconds) even when no XP is granted
      const updated = await xpDao.apply(guildId, userId, 0, member.level, counters)
      return {
        result: {
          awarded: 0,
          member: updated,
          oldLevel: member.level,
          newLevel: member.level,
          leveledUp: false,
        },
        attendanceEventIds,
      }
    }

    const oldLevel = member.level
    const newXp = member.xp + awarded
    const newLevel = levelFromXp(newXp)
    const updated = await xpDao.apply(guildId, userId, awarded, newLevel, counters)

    return {
      result: { awarded, member: updated, oldLevel, newLevel, leveledUp: newLevel > oldLevel },
      attendanceEventIds,
    }
  },

  /** Chat XP with per-user cooldown enforced here (the anti-spam-farm rule). */
  async grantMessage(
    guildId: string,
    userId: string,
    username: string,
    channelId: string,
  ): Promise<{ result: GrantResult; attendanceEventIds: number[] } | { skip: SkipReason }> {
    const cfg = await rulesService.getConfig(guildId)
    const existing = await xpDao.get(guildId, userId)
    const at = nowSec()
    if (existing?.lastMessageAt && at - existing.lastMessageAt < cfg.messageCooldownSec) {
      return { skip: 'cooldown' }
    }
    return this.grant(guildId, userId, username, cfg.messageXp, channelId, {
      messageCount: 1,
      lastMessageAt: at,
    })
  },

  /**
   * Admin XP Boost: apply a signed delta to a member's XP (clamped at 0), recompute
   * level, and return the before/after. Reconciliation (roles/badges/announcement) is
   * the caller's job — see the reconcile service. Creates the row if the member is new.
   */
  async adjust(
    guildId: string,
    userId: string,
    username: string,
    delta: number,
  ): Promise<GrantResult> {
    // ensure() upserts the username too, so a boost also refreshes a stale/placeholder
    // name (e.g. a row first created by a boost before the real name was known).
    const base = await xpDao.ensure(guildId, userId, username)
    const oldLevel = base.level
    const newXp = Math.max(0, base.xp + delta)
    const newLevel = levelFromXp(newXp)
    const member = await xpDao.setXp(guildId, userId, newXp, newLevel)
    return { awarded: newXp - base.xp, member, oldLevel, newLevel, leveledUp: newLevel > oldLevel }
  },

  leaderboard: xpDao.leaderboard,
  rank: xpDao.rank,
  count: xpDao.count,
  get: xpDao.get,
}
