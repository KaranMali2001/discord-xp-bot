import type { channelRules, multiplierEvents } from '../../db/schema'
import { withRetry } from '../../util/retry'
import { localClock, nowSec } from '../../util/time'
import { type EventWithTargets, rulesDao } from './rules.dao'

type EventRow = typeof multiplierEvents.$inferSelect
type ChannelRuleRow = typeof channelRules.$inferSelect

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

/** Merge a stored guild_config row over the defaults into a complete config object. */
function resolveConfig(row: Awaited<ReturnType<typeof rulesDao.getConfig>>): ResolvedConfig {
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
}

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

// ── In-memory read cache (§2.1 — the scale-to-zero enabler) ───────────────────────────────
// Everything the XP-decision path reads for a guild (config + events + channel rules) is one
// coherent snapshot. The bot ENABLES the cache at boot and reads it forever; it re-fetches only
// when the API (the writer) signals a change (rulesService.invalidate) or the 30-min backstop
// clears it. When idle the bot issues ZERO DB queries → Neon scales to zero. The cache is
// process-scoped and OFF by default, so the API (and tests) always read straight from Postgres
// and never serve a stale dashboard.
interface GuildRules {
  config: ResolvedConfig
  events: EventWithTargets[]
  channelRules: ChannelRuleRow[]
}

let cacheEnabled = false
const cache = new Map<string, GuildRules>()

/** Pull one guild's full rules snapshot from Postgres (retried on transient blips). */
async function fetchGuild(guildId: string): Promise<GuildRules> {
  const [configRow, events, channelRuleRows] = await withRetry(() =>
    Promise.all([
      rulesDao.getConfig(guildId),
      rulesDao.listEvents(guildId),
      rulesDao.listChannelRules(guildId),
    ]),
  )
  return { config: resolveConfig(configRow), events, channelRules: channelRuleRows }
}

/** Cache-hit when enabled + warm; otherwise a fresh read-through (API path / cold bot). */
async function guildRules(guildId: string): Promise<GuildRules> {
  if (!cacheEnabled) return fetchGuild(guildId)
  const hit = cache.get(guildId)
  if (hit) return hit
  const loaded = await fetchGuild(guildId)
  cache.set(guildId, loaded)
  return loaded
}

export const rulesService = {
  /** Arm the in-memory cache for this process. Called once by the bot at boot; never the API. */
  enableCache(): void {
    cacheEnabled = true
  },

  /** Drop one guild's cached snapshot so the next read re-fetches it (API write signal). */
  invalidate(guildId: string): void {
    cache.delete(guildId)
  },

  /** Clear the whole cache — the 30-min backstop reload, and a manual full refresh. */
  invalidateAll(): void {
    cache.clear()
  },

  /** Warm the cache for a set of guilds up front (bot boot) so the first tick issues no burst. */
  async warm(guildIds: Iterable<string>): Promise<void> {
    for (const guildId of guildIds) {
      cache.set(guildId, await fetchGuild(guildId))
    }
  },

  /** Guild config merged over defaults — always returns a complete object. */
  async getConfig(guildId: string): Promise<ResolvedConfig> {
    return (await guildRules(guildId)).config
  },

  /** All multiplier events for a guild (cached alongside config on the bot). */
  async getEvents(guildId: string): Promise<EventWithTargets[]> {
    return (await guildRules(guildId)).events
  },

  /** Per-channel override, or a passthrough (×1, XP allowed) if none set. */
  async channelRule(
    guildId: string,
    channelId: string,
  ): Promise<{ multiplier: number; noXp: boolean }> {
    const rule = (await guildRules(guildId)).channelRules.find((r) => r.channelId === channelId)
    return rule ? { multiplier: rule.multiplier, noXp: rule.noXp } : { multiplier: 1, noXp: false }
  },

  /**
   * The full XP multiplier for a channel right now, plus the ids of any active
   * attendance-counting events (so voice ticks can record Friday attendance).
   * Channel and event multipliers stack multiplicatively (Lurkr-style).
   */
  async effectiveMultiplier(
    guildId: string,
    channelId: string,
    atSec: number = nowSec(),
    userId?: string,
  ): Promise<{ multiplier: number; noXp: boolean; attendanceEventIds: number[] }> {
    const gr = await guildRules(guildId)
    const chRule = gr.channelRules.find((r) => r.channelId === channelId)
    if (chRule?.noXp) return { multiplier: 0, noXp: true, attendanceEventIds: [] }

    let multiplier = chRule?.multiplier ?? 1
    const attendanceEventIds: number[] = []

    for (const e of gr.events) {
      if (e.channelId != null && e.channelId !== channelId) continue
      if (!isEventActive(e, atSec)) continue
      if (e.countsAttendance) attendanceEventIds.push(e.id)
      if (e.targetUserIds.length > 0 && (!userId || !e.targetUserIds.includes(userId))) continue
      multiplier *= e.multiplier
    }

    return { multiplier, noXp: false, attendanceEventIds }
  },
}
