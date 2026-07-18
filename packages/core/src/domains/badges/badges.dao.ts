import { and, eq } from 'drizzle-orm'
import { db } from '../../db/client'
import { badges, memberBadges } from '../../db/schema'
import type { BadgeInput } from './badges.schema'

export type Badge = typeof badges.$inferSelect

export const badgesDao = {
  async list(guildId: string): Promise<Badge[]> {
    return db.select().from(badges).where(eq(badges.guildId, guildId))
  },

  async upsert(guildId: string, input: BadgeInput): Promise<Badge> {
    const [row] = await db
      .insert(badges)
      .values({ guildId, ...input })
      .onConflictDoUpdate({
        target: [badges.guildId, badges.key],
        set: {
          name: input.name,
          description: input.description,
          emoji: input.emoji,
          criteria: input.criteria,
          threshold: input.threshold,
        },
      })
      .returning()
    if (!row) throw new Error('badges upsert returned no row')
    return row
  },

  async remove(guildId: string, key: string) {
    await db.delete(badges).where(and(eq(badges.guildId, guildId), eq(badges.key, key)))
  },

  async owned(guildId: string, userId: string): Promise<string[]> {
    const rows = await db
      .select({ key: memberBadges.badgeKey })
      .from(memberBadges)
      .where(and(eq(memberBadges.guildId, guildId), eq(memberBadges.userId, userId)))
    return rows.map((r) => r.key)
  },

  async award(guildId: string, userId: string, badgeKey: string) {
    await db.insert(memberBadges).values({ guildId, userId, badgeKey }).onConflictDoNothing()
  },
}
