import { and, eq, sql } from 'drizzle-orm'
import { db } from '../../db/client'
import { eventAttendance } from '../../db/schema'
import { utcDay } from '../../util/time'

export const voiceDao = {
  /** Idempotent per (member, event, day) — one Friday attended = one row, however long they stayed. */
  recordAttendance(guildId: string, userId: string, eventId: number, atSec?: number) {
    db.insert(eventAttendance)
      .values({ guildId, userId, eventId, day: utcDay(atSec) })
      .onConflictDoNothing()
      .run()
  },

  /** How many distinct attendance-days a member has across all events (the "fridays_attended" stat). */
  attendanceDays(guildId: string, userId: string): number {
    const row = db
      .select({ n: sql<number>`count(*)` })
      .from(eventAttendance)
      .where(and(eq(eventAttendance.guildId, guildId), eq(eventAttendance.userId, userId)))
      .get()
    return row?.n ?? 0
  },
}
