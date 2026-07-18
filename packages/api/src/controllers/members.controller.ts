import { announceReconcile, discordRest, reconcileMember, xpService } from '@xp/core'
import { z } from 'zod'
import { parse } from '../lib/validate'

const boostBody = z.object({
  delta: z.number().int().min(-1_000_000).max(1_000_000),
  // Needed only when boosting a member who has no XP row yet.
  username: z.string().optional(),
})

export const membersController = {
  /**
   * Admin XP Boost: apply a signed delta, then Reconcile (roles + badges) and announce
   * any threshold crossing — the same pipeline live grants use, per ADR 0001.
   */
  async boostXp(guildId: string, userId: string, body: unknown) {
    const { delta, username } = parse(boostBody, body)
    const existing = await xpService.get(guildId, userId)
    // Prefer an explicit name; else the stored one; else look the member up on Discord
    // so a freshly-created row never falls back to the placeholder "member".
    let name = username ?? existing?.username
    if (!name || name === 'member') {
      const m = await discordRest.member(guildId, userId).catch(() => null)
      if (m) name = m.displayName
    }
    const result = await xpService.adjust(guildId, userId, name ?? 'member', delta)

    const reconciled = await reconcileMember(guildId, userId, result.oldLevel)
    if (reconciled) await announceReconcile(guildId, userId, reconciled)

    return {
      member: result.member,
      awarded: result.awarded,
      oldLevel: result.oldLevel,
      newLevel: result.newLevel,
      leveledUp: result.leveledUp,
    }
  },
}
