import { and, eq } from 'drizzle-orm'
import { db } from '../../db/client'
import { admins } from '../../db/schema'

export const authDao = {
  list(guildId: string): string[] {
    return db
      .select({ userId: admins.userId })
      .from(admins)
      .where(eq(admins.guildId, guildId))
      .all()
      .map((r) => r.userId)
  },

  isAdmin(guildId: string, userId: string): boolean {
    return !!db
      .select({ userId: admins.userId })
      .from(admins)
      .where(and(eq(admins.guildId, guildId), eq(admins.userId, userId)))
      .get()
  },

  add(guildId: string, userId: string) {
    db.insert(admins).values({ guildId, userId }).onConflictDoNothing().run()
  },

  remove(guildId: string, userId: string) {
    db.delete(admins)
      .where(and(eq(admins.guildId, guildId), eq(admins.userId, userId)))
      .run()
  },
}
