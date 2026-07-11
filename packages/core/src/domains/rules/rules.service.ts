import type { multiplierEvents } from '../../db/schema'
import { localClock, nowSec } from '../../util/time'
import { rulesDao } from './rules.dao'

type EventRow = typeof multiplierEvents.$inferSelect

/** Defaults used when a guild hasn't customised anything yet. */
export const DEFAULT_CONFIG = {
  messageXp: 3,
  messageCooldownSec: 60,
  voicePresenceXpPerMin: 2,
  voiceSpeakingXpPerMin: 5,
  ignoreMutedVoice: true,
  levelUpChannelId: null as string | null,
  levelUpMessage: '🎉 {user} reached level **{level}**!',
  tierUpMessage: '🎖️ {user} is now **{role}**!',
  voiceCaptureChannelId: null as string | null,
}
export type ResolvedConfig = typeof DEFAULT_CONFIG

/** True if event `e` is active at `atSec` (handles both recurring and one-off shapes). */
export function isEventActive(e: EventRow, atSec: number): boolean {
  if (!e.enabled) return false
  if (e.startsAt != null && e.endsAt != null) {
    return atSec >= e.startsAt && atSec < e.endsAt
  }
  if (e.dayOfWeek != null && e.startMinute != null && e.endMinute != null) {
    const { dow, minute } = localClock(atSec) // IST — matches how the dashboard takes input
    return dow === e.dayOfWeek && minute >= e.startMinute && minute < e.endMinute
  }
  return false
}

export const rulesService = {
  /** Guild config merged over defaults — always returns a complete object. */
  getConfig(guildId: string): ResolvedConfig {
    const row = rulesDao.getConfig(guildId)
    if (!row) return { ...DEFAULT_CONFIG }
    return {
      messageXp: row.messageXp,
      messageCooldownSec: row.messageCooldownSec,
      voicePresenceXpPerMin: row.voicePresenceXpPerMin,
      voiceSpeakingXpPerMin: row.voiceSpeakingXpPerMin,
      ignoreMutedVoice: row.ignoreMutedVoice,
      levelUpChannelId: row.levelUpChannelId,
      levelUpMessage: row.levelUpMessage,
      tierUpMessage: row.tierUpMessage,
      voiceCaptureChannelId: row.voiceCaptureChannelId,
    }
  },

  /** Per-channel override, or a passthrough (×1, XP allowed) if none set. */
  channelRule(guildId: string, channelId: string): { multiplier: number; noXp: boolean } {
    const rule = rulesDao.getChannelRule(guildId, channelId)
    return rule ? { multiplier: rule.multiplier, noXp: rule.noXp } : { multiplier: 1, noXp: false }
  },

  /**
   * The full XP multiplier for a channel right now, plus the ids of any active
   * attendance-counting events (so voice ticks can record Friday attendance).
   * Channel and event multipliers stack multiplicatively (Lurkr-style).
   */
  effectiveMultiplier(
    guildId: string,
    channelId: string,
    atSec: number = nowSec(),
  ): { multiplier: number; noXp: boolean; attendanceEventIds: number[] } {
    const ch = this.channelRule(guildId, channelId)
    if (ch.noXp) return { multiplier: 0, noXp: true, attendanceEventIds: [] }

    let multiplier = ch.multiplier
    const attendanceEventIds: number[] = []

    for (const e of rulesDao.listEvents(guildId)) {
      if (e.channelId != null && e.channelId !== channelId) continue
      if (!isEventActive(e, atSec)) continue
      multiplier *= e.multiplier
      if (e.countsAttendance) attendanceEventIds.push(e.id)
    }

    return { multiplier, noXp: false, attendanceEventIds }
  },
}
