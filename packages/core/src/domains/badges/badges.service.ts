import { voiceService } from '../voice/voice.service'
import type { Member } from '../xp/xp.dao'
import { xpService } from '../xp/xp.service'
import { type Badge, badgesDao } from './badges.dao'

/** Current value of the stat a badge measures, for a given member. */
function statFor(criteria: Badge['criteria'], m: Member, attendanceDays: number): number {
  switch (criteria) {
    case 'level':
      return m.level
    case 'messages':
      return m.messageCount
    case 'voice_minutes':
      return Math.floor(m.voiceSeconds / 60)
    case 'speaking_minutes':
      return Math.floor(m.speakingSeconds / 60)
    case 'fridays_attended':
      return attendanceDays
  }
}

export const badgesService = {
  list: badgesDao.list,
  upsert: badgesDao.upsert,
  remove: badgesDao.remove,
  owned: badgesDao.owned,

  /**
   * Evaluate every badge for a member and award any newly-earned ones.
   * Returns the badges awarded *this call* (so the bot can announce them).
   */
  evaluate(guildId: string, userId: string): Badge[] {
    const member = xpService.get(guildId, userId)
    if (!member) return []

    const defs = badgesDao.list(guildId)
    if (defs.length === 0) return []

    const owned = new Set(badgesDao.owned(guildId, userId))
    const attendanceDays = defs.some((d) => d.criteria === 'fridays_attended')
      ? voiceService.attendanceDays(guildId, userId)
      : 0

    const newly: Badge[] = []
    for (const def of defs) {
      if (owned.has(def.key)) continue
      if (statFor(def.criteria, member, attendanceDays) >= def.threshold) {
        badgesDao.award(guildId, userId, def.key)
        newly.push(def)
      }
    }
    return newly
  },
}
