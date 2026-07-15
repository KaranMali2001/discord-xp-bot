import { and, asc, eq, lt, lte } from 'drizzle-orm'
import { db } from '../../db/client'
import { scheduledAnnouncements } from '../../db/schema'
import { nowSec } from '../../util/time'

export type ScheduledStatus = 'pending' | 'sent' | 'missed' | 'cancelled'

/** A scheduled row with mention ids decoded back into arrays. */
export interface ScheduledAnnouncement {
  id: number
  guildId: string
  channelId: string
  message: string
  memberIds: string[]
  roleIds: string[]
  mentionEveryone: boolean
  fireAt: number
  status: ScheduledStatus
  createdBy: string
  createdAt: number
  sentAt: number | null
}

export interface ScheduledCreateInput {
  guildId: string
  channelId: string
  message: string
  memberIds: string[]
  roleIds: string[]
  mentionEveryone: boolean
  fireAt: number
  createdBy: string
}

type Row = typeof scheduledAnnouncements.$inferSelect

function safeIds(json: string): string[] {
  try {
    const v = JSON.parse(json)
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

function toModel(r: Row): ScheduledAnnouncement {
  return {
    id: r.id,
    guildId: r.guildId,
    channelId: r.channelId,
    message: r.message,
    memberIds: safeIds(r.memberIds),
    roleIds: safeIds(r.roleIds),
    mentionEveryone: r.mentionEveryone,
    fireAt: r.fireAt,
    status: r.status,
    createdBy: r.createdBy,
    createdAt: r.createdAt,
    sentAt: r.sentAt,
  }
}

export const scheduledDao = {
  create(input: ScheduledCreateInput): ScheduledAnnouncement {
    const rows = db
      .insert(scheduledAnnouncements)
      .values({
        guildId: input.guildId,
        channelId: input.channelId,
        message: input.message,
        memberIds: JSON.stringify(input.memberIds),
        roleIds: JSON.stringify(input.roleIds),
        mentionEveryone: input.mentionEveryone,
        fireAt: input.fireAt,
        createdBy: input.createdBy,
      })
      .returning()
      .all()
    const row = rows[0]
    if (!row) throw new Error('Failed to create scheduled announcement')
    return toModel(row)
  },

  /** Upcoming (still pending) announcements for a guild, soonest first. */
  listUpcoming(guildId: string): ScheduledAnnouncement[] {
    return db
      .select()
      .from(scheduledAnnouncements)
      .where(
        and(
          eq(scheduledAnnouncements.guildId, guildId),
          eq(scheduledAnnouncements.status, 'pending'),
        ),
      )
      .orderBy(asc(scheduledAnnouncements.fireAt))
      .all()
      .map(toModel)
  },

  /** Pending rows whose fire time has arrived — the scheduler tick's work list. */
  listDue(at: number = nowSec()): ScheduledAnnouncement[] {
    return db
      .select()
      .from(scheduledAnnouncements)
      .where(
        and(eq(scheduledAnnouncements.status, 'pending'), lte(scheduledAnnouncements.fireAt, at)),
      )
      .orderBy(asc(scheduledAnnouncements.fireAt))
      .all()
      .map(toModel)
  },

  markSent(id: number): void {
    db.update(scheduledAnnouncements)
      .set({ status: 'sent', sentAt: nowSec() })
      .where(eq(scheduledAnnouncements.id, id))
      .run()
  },

  /** Skip-missed policy: anything still pending but overdue is marked, never sent. */
  sweepMissed(before: number = nowSec()): number {
    const res = db
      .update(scheduledAnnouncements)
      .set({ status: 'missed' })
      .where(
        and(
          eq(scheduledAnnouncements.status, 'pending'),
          lt(scheduledAnnouncements.fireAt, before),
        ),
      )
      .run()
    return res.changes
  },

  /** Cancel a pending announcement. Returns false if it wasn't pending (or absent). */
  cancel(guildId: string, id: number): boolean {
    const res = db
      .update(scheduledAnnouncements)
      .set({ status: 'cancelled' })
      .where(
        and(
          eq(scheduledAnnouncements.id, id),
          eq(scheduledAnnouncements.guildId, guildId),
          eq(scheduledAnnouncements.status, 'pending'),
        ),
      )
      .run()
    return res.changes > 0
  },
}
