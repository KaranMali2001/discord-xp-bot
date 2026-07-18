import { and, desc, eq, sql } from 'drizzle-orm'
import { db } from '../../db/client'
import { members } from '../../db/schema'
import { nowSec } from '../../util/time'

export type Member = typeof members.$inferSelect

/** Counters we can bump alongside an XP grant. */
export interface CounterDelta {
  messageCount?: number
  voiceSeconds?: number
  speakingSeconds?: number
  lastMessageAt?: number
}

export const xpDao = {
  async get(guildId: string, userId: string): Promise<Member | undefined> {
    const [row] = await db
      .select()
      .from(members)
      .where(and(eq(members.guildId, guildId), eq(members.userId, userId)))
    return row
  },

  async ensure(guildId: string, userId: string, username: string): Promise<Member> {
    const [row] = await db
      .insert(members)
      .values({ guildId, userId, username })
      .onConflictDoUpdate({
        target: [members.guildId, members.userId],
        set: { username },
      })
      .returning()
    if (!row) throw new Error('members upsert returned no row')
    return row
  },

  /** Atomically add XP + counters and set the new level. Returns the fresh row. */
  async apply(
    guildId: string,
    userId: string,
    xpDelta: number,
    newLevel: number,
    counters: CounterDelta,
  ): Promise<Member> {
    const [row] = await db
      .update(members)
      .set({
        xp: sql`${members.xp} + ${xpDelta}`,
        level: newLevel,
        messageCount: sql`${members.messageCount} + ${counters.messageCount ?? 0}`,
        voiceSeconds: sql`${members.voiceSeconds} + ${counters.voiceSeconds ?? 0}`,
        speakingSeconds: sql`${members.speakingSeconds} + ${counters.speakingSeconds ?? 0}`,
        lastMessageAt: counters.lastMessageAt ?? sql`${members.lastMessageAt}`,
        updatedAt: nowSec(),
      })
      .where(and(eq(members.guildId, guildId), eq(members.userId, userId)))
      .returning()
    if (!row) throw new Error('members upsert returned no row')
    return row
  },

  /** Set XP + level to absolute values (used by admin XP Boosts). Returns the fresh row. */
  async setXp(guildId: string, userId: string, xp: number, level: number): Promise<Member> {
    const [row] = await db
      .update(members)
      .set({ xp, level, updatedAt: nowSec() })
      .where(and(eq(members.guildId, guildId), eq(members.userId, userId)))
      .returning()
    if (!row) throw new Error('members upsert returned no row')
    return row
  },

  async leaderboard(guildId: string, limit = 25, offset = 0): Promise<Member[]> {
    return db
      .select()
      .from(members)
      .where(eq(members.guildId, guildId))
      .orderBy(desc(members.xp))
      .limit(limit)
      .offset(offset)
  },

  async rank(guildId: string, userId: string): Promise<number | null> {
    const me = await this.get(guildId, userId)
    if (!me) return null
    // count(*) is int8 → node-postgres returns it as a string; ::int coerces to a JS number.
    const [row] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(members)
      .where(and(eq(members.guildId, guildId), sql`${members.xp} > ${me.xp}`))
    return (row?.n ?? 0) + 1
  },

  async count(guildId: string): Promise<number> {
    const [row] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(members)
      .where(eq(members.guildId, guildId))
    return row?.n ?? 0
  },
}
