import { nowSec } from '../../util/time'
import { rulesService } from '../rules/rules.service'
import type { GrantResult, SkipReason } from '../xp/xp.service'
import { xpService } from '../xp/xp.service'
import { voiceDao } from './voice.dao'

export interface VoiceTick {
  guildId: string
  userId: string
  username: string
  channelId: string
  /** seconds of this tick the member was present (and audible if ignoreMuted). */
  presentSeconds: number
  /** true if the member transmitted audio at any point this tick. */
  spoke: boolean
}

/** One tick of raw voice presence to attribute to any active attendance event(s). */
export interface DurationTick {
  guildId: string
  userId: string
  username: string
  channelId: string
  /** elapsed seconds this tick, regardless of mute state. */
  seconds: number
  /** self/server muted or deafened this tick. */
  muted: boolean
  /** true if the receiver reported them transmitting audio this tick. */
  spoke: boolean
}

export const voiceService = {
  /**
   * One voice interval's worth of XP. Granularity (per our decision): if the member
   * spoke *at all* this tick, the whole tick is billed at the speaking rate; otherwise
   * at the presence rate. Also records attendance for any active Friday-style event.
   */
  grantTick(tick: VoiceTick): { result: GrantResult } | { skip: SkipReason } {
    const cfg = rulesService.getConfig(tick.guildId)
    if (tick.presentSeconds <= 0) return { skip: 'zero_multiplier' }

    const perMin = tick.spoke ? cfg.voiceSpeakingXpPerMin : cfg.voicePresenceXpPerMin
    const base = (perMin * tick.presentSeconds) / 60

    const outcome = xpService.grant(
      tick.guildId,
      tick.userId,
      tick.username,
      base,
      tick.channelId,
      {
        voiceSeconds: tick.presentSeconds,
        speakingSeconds: tick.spoke ? tick.presentSeconds : 0,
      },
    )

    if ('skip' in outcome) return { skip: outcome.skip }

    const at = nowSec()
    for (const eventId of outcome.attendanceEventIds) {
      voiceDao.recordAttendance(tick.guildId, tick.userId, eventId, at)
    }
    return { result: outcome.result }
  },

  /**
   * Fold one tick of raw presence into the per-event duration accumulator. Called every
   * tick — INCLUDING muted ticks that `grantTick` skips — so muted time is captured. Uses
   * the same event resolution as XP (`effectiveMultiplier`), so a no-XP channel records no
   * duration, keeping the numbers consistent with binary attendance.
   */
  recordDuration(tick: DurationTick): void {
    if (tick.seconds <= 0) return
    const at = nowSec()
    const { attendanceEventIds } = rulesService.effectiveMultiplier(
      tick.guildId,
      tick.channelId,
      at,
    )
    for (const eventId of attendanceEventIds) {
      voiceDao.recordActivity({
        guildId: tick.guildId,
        userId: tick.userId,
        username: tick.username,
        eventId,
        channelId: tick.channelId,
        seconds: tick.seconds,
        mutedSeconds: tick.muted ? tick.seconds : 0,
        speakingSeconds: tick.spoke ? tick.seconds : 0,
        atSec: at,
      })
    }
  },

  attendanceDays: voiceDao.attendanceDays,
  statsForEvent: voiceDao.statsForEvent,
}
