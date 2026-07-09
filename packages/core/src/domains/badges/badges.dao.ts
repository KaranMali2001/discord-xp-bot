import { and, eq } from 'drizzle-orm'
import { db } from '../../db/client'
import { badges, memberBadges } from '../../db/schema'
import type { BadgeInput } from './badges.schema'

export type Badge = typeof badges.$inferSelect

export const badgesDao = {
  list(guildId: string): Badge[] {
    return db.select().from(badges).where(eq(badges.guildId, guildId)).all()
  },

  upsert(guildId: string, input: BadgeInput): Badge {
    return db
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
      .get()
  },

  remove(guildId: string, key: string) {
    db.delete(badges)
      .where(and(eq(badges.guildId, guildId), eq(badges.key, key)))
      .run()
  },

  owned(guildId: string, userId: string): string[] {
    return db
      .select({ key: memberBadges.badgeKey })
      .from(memberBadges)
      .where(and(eq(memberBadges.guildId, guildId), eq(memberBadges.userId, userId)))
      .all()
      .map((r) => r.key)
  },

  award(guildId: string, userId: string, badgeKey: string) {
    db.insert(memberBadges).values({ guildId, userId, badgeKey }).onConflictDoNothing().run()
  },
}
