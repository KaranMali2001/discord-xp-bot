import { and, desc, eq, sql } from 'drizzle-orm'
import { db } from '../../db/client'
import { eventAttendance, eventVoiceStats } from '../../db/schema'
import { istDay, nowSec } from '../../util/time'

/** One tick's worth of voice duration to fold into the event-day accumulator. */
export interface ActivityDelta {
  guildId: string
  userId: string
  username: string
  eventId: number
  channelId: string
  seconds: number
  mutedSeconds: number
  speakingSeconds: number
  atSec?: number
}

/** Per-user attendance summary for one event (summed across all its occurrences). */
export interface EventAttendanceRow {
  userId: string
  username: string
  presentSeconds: number
  mutedSeconds: number
  speakingSeconds: number
  days: number
}

export const voiceDao = {
  /** Idempotent per (member, event, day) — one Friday attended = one row, however long they stayed. */
  async recordAttendance(guildId: string, userId: string, eventId: number, atSec?: number) {
    await db
      .insert(eventAttendance)
      .values({ guildId, userId, eventId, day: istDay(atSec) })
      .onConflictDoNothing()
  },

  /**
   * Add one tick's duration to the (member, event, day) accumulator, creating the row on
   * first sight and incrementing thereafter. Rejoins land in the same row (same day) — the
   * counters just keep growing.
   */
  async recordActivity(d: ActivityDelta) {
    const at = d.atSec ?? nowSec()
    await db
      .insert(eventVoiceStats)
      .values({
        guildId: d.guildId,
        userId: d.userId,
        eventId: d.eventId,
        day: istDay(at),
        username: d.username,
        channelId: d.channelId,
        presentSeconds: d.seconds,
        mutedSeconds: d.mutedSeconds,
        speakingSeconds: d.speakingSeconds,
        firstSeenAt: at,
        lastSeenAt: at,
      })
      .onConflictDoUpdate({
        target: [
          eventVoiceStats.guildId,
          eventVoiceStats.userId,
          eventVoiceStats.eventId,
          eventVoiceStats.day,
        ],
        set: {
          presentSeconds: sql`${eventVoiceStats.presentSeconds} + ${d.seconds}`,
          mutedSeconds: sql`${eventVoiceStats.mutedSeconds} + ${d.mutedSeconds}`,
          speakingSeconds: sql`${eventVoiceStats.speakingSeconds} + ${d.speakingSeconds}`,
          username: d.username,
          channelId: d.channelId,
          lastSeenAt: at,
        },
      })
  },

  /** Per-user attendance summary for one event, summed across every day it ran. */
  async statsForEvent(guildId: string, eventId: number): Promise<EventAttendanceRow[]> {
    // sum()/count() are numeric/int8 → node-postgres returns them as strings; ::int coerces.
    return db
      .select({
        userId: eventVoiceStats.userId,
        username: sql<string>`max(${eventVoiceStats.username})`,
        presentSeconds: sql<number>`sum(${eventVoiceStats.presentSeconds})::int`,
        mutedSeconds: sql<number>`sum(${eventVoiceStats.mutedSeconds})::int`,
        speakingSeconds: sql<number>`sum(${eventVoiceStats.speakingSeconds})::int`,
        days: sql<number>`count(distinct ${eventVoiceStats.day})::int`,
      })
      .from(eventVoiceStats)
      .where(and(eq(eventVoiceStats.guildId, guildId), eq(eventVoiceStats.eventId, eventId)))
      .groupBy(eventVoiceStats.userId)
      .orderBy(desc(sql`sum(${eventVoiceStats.presentSeconds})`))
  },

  /** How many distinct attendance-days a member has across all events (the "fridays_attended" stat). */
  async attendanceDays(guildId: string, userId: string): Promise<number> {
    const [row] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(eventAttendance)
      .where(and(eq(eventAttendance.guildId, guildId), eq(eventAttendance.userId, userId)))
    return row?.n ?? 0
  },
}
