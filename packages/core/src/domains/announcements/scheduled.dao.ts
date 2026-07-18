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
  async create(input: ScheduledCreateInput): Promise<ScheduledAnnouncement> {
    const rows = await db
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
    const row = rows[0]
    if (!row) throw new Error('Failed to create scheduled announcement')
    return toModel(row)
  },

  /** Upcoming (still pending) announcements for a guild, soonest first. */
  async listUpcoming(guildId: string): Promise<ScheduledAnnouncement[]> {
    const rows = await db
      .select()
      .from(scheduledAnnouncements)
      .where(
        and(
          eq(scheduledAnnouncements.guildId, guildId),
          eq(scheduledAnnouncements.status, 'pending'),
        ),
      )
      .orderBy(asc(scheduledAnnouncements.fireAt))
    return rows.map(toModel)
  },

  /**
   * Epoch-seconds of the EARLIEST still-pending announcement, or null if none. The scheduler
   * keeps this one value in memory so an idle bot can decide "nothing is due yet" WITHOUT a DB
   * query every tick — the enabler for Neon scale-to-zero (§2.1). Reads the column directly
   * (bigint mode:'number') rather than an aggregate, so no int8-as-string coercion is needed.
   */
  async earliestPending(): Promise<number | null> {
    const [row] = await db
      .select({ fireAt: scheduledAnnouncements.fireAt })
      .from(scheduledAnnouncements)
      .where(eq(scheduledAnnouncements.status, 'pending'))
      .orderBy(asc(scheduledAnnouncements.fireAt))
      .limit(1)
    return row?.fireAt ?? null
  },

  /** Pending rows whose fire time has arrived — the scheduler tick's work list. */
  async listDue(at: number = nowSec()): Promise<ScheduledAnnouncement[]> {
    const rows = await db
      .select()
      .from(scheduledAnnouncements)
      .where(
        and(eq(scheduledAnnouncements.status, 'pending'), lte(scheduledAnnouncements.fireAt, at)),
      )
      .orderBy(asc(scheduledAnnouncements.fireAt))
    return rows.map(toModel)
  },

  /**
   * Atomically CLAIM one pending row right before posting it: flip `pending → sent` guarded by
   * `WHERE id = ? AND status = 'pending'` and report whether THIS call won it. Because the
   * `UPDATE … RETURNING` is a single atomic statement, two concurrent schedulers can never both
   * claim the same announcement — the loser gets `false` and skips it (the guard the old bare
   * `markSent` lacked).
   *
   * TRADE-OFF: this marks `sent` BEFORE the post (at-MOST-once), whereas the old flow marked sent
   * only AFTER a successful post (at-LEAST-once). We deliberately prefer at-most-once here: for an
   * @everyone announcement a double-post is far worse than a rare miss. Claiming per-row keeps the
   * exposure to a SINGLE in-flight row, and a crash in the tiny window between claim and post drops
   * just that one announcement — which is consistent with the skip-missed policy (an announcement
   * whose moment passed is never posted late). On a post FAILURE we roll back to `pending`
   * (`releaseToPending`) so it retries; only an actual process crash in that window loses the row.
   */
  async claimOne(id: number): Promise<boolean> {
    const rows = await db
      .update(scheduledAnnouncements)
      .set({ status: 'sent', sentAt: nowSec() })
      .where(and(eq(scheduledAnnouncements.id, id), eq(scheduledAnnouncements.status, 'pending')))
      .returning({ id: scheduledAnnouncements.id })
    return rows.length > 0
  },

  /** Undo a claim when the post failed, so the next tick retries it. */
  async releaseToPending(id: number): Promise<void> {
    await db
      .update(scheduledAnnouncements)
      .set({ status: 'pending', sentAt: null })
      .where(and(eq(scheduledAnnouncements.id, id), eq(scheduledAnnouncements.status, 'sent')))
  },

  /** Skip-missed policy: anything still pending but overdue is marked, never sent. */
  async sweepMissed(before: number = nowSec()): Promise<number> {
    // pg has no `.changes`; RETURNING the ids and counting them gives the affected-row count.
    const rows = await db
      .update(scheduledAnnouncements)
      .set({ status: 'missed' })
      .where(
        and(
          eq(scheduledAnnouncements.status, 'pending'),
          lt(scheduledAnnouncements.fireAt, before),
        ),
      )
      .returning({ id: scheduledAnnouncements.id })
    return rows.length
  },

  /** Cancel a pending announcement. Returns false if it wasn't pending (or absent). */
  async cancel(guildId: string, id: number): Promise<boolean> {
    const rows = await db
      .update(scheduledAnnouncements)
      .set({ status: 'cancelled' })
      .where(
        and(
          eq(scheduledAnnouncements.id, id),
          eq(scheduledAnnouncements.guildId, guildId),
          eq(scheduledAnnouncements.status, 'pending'),
        ),
      )
      .returning({ id: scheduledAnnouncements.id })
    return rows.length > 0
  },
}
