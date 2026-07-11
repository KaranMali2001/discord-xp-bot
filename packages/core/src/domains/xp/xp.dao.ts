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
  get(guildId: string, userId: string): Member | undefined {
    return db
      .select()
      .from(members)
      .where(and(eq(members.guildId, guildId), eq(members.userId, userId)))
      .get()
  },

  ensure(guildId: string, userId: string, username: string): Member {
    return db
      .insert(members)
      .values({ guildId, userId, username })
      .onConflictDoUpdate({
        target: [members.guildId, members.userId],
        set: { username },
      })
      .returning()
      .get()
  },

  /** Atomically add XP + counters and set the new level. Returns the fresh row. */
  apply(
    guildId: string,
    userId: string,
    xpDelta: number,
    newLevel: number,
    counters: CounterDelta,
  ): Member {
    return db
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
      .get()
  },

  /** Set XP + level to absolute values (used by admin XP Boosts). Returns the fresh row. */
  setXp(guildId: string, userId: string, xp: number, level: number): Member {
    return db
      .update(members)
      .set({ xp, level, updatedAt: nowSec() })
      .where(and(eq(members.guildId, guildId), eq(members.userId, userId)))
      .returning()
      .get()
  },

  leaderboard(guildId: string, limit = 25, offset = 0): Member[] {
    return db
      .select()
      .from(members)
      .where(eq(members.guildId, guildId))
      .orderBy(desc(members.xp))
      .limit(limit)
      .offset(offset)
      .all()
  },

  rank(guildId: string, userId: string): number | null {
    const me = this.get(guildId, userId)
    if (!me) return null
    const row = db
      .select({ n: sql<number>`count(*)` })
      .from(members)
      .where(and(eq(members.guildId, guildId), sql`${members.xp} > ${me.xp}`))
      .get()
    return (row?.n ?? 0) + 1
  },

  count(guildId: string): number {
    const row = db
      .select({ n: sql<number>`count(*)` })
      .from(members)
      .where(eq(members.guildId, guildId))
      .get()
    return row?.n ?? 0
  },
}
