import { and, eq } from 'drizzle-orm'
import { db } from '../../db/client'
import { admins } from '../../db/schema'

export const authDao = {
  async list(guildId: string): Promise<string[]> {
    const rows = await db
      .select({ userId: admins.userId })
      .from(admins)
      .where(eq(admins.guildId, guildId))
    return rows.map((r) => r.userId)
  },

  async isAdmin(guildId: string, userId: string): Promise<boolean> {
    const [row] = await db
      .select({ userId: admins.userId })
      .from(admins)
      .where(and(eq(admins.guildId, guildId), eq(admins.userId, userId)))
    return Boolean(row)
  },

  async add(guildId: string, userId: string) {
    await db.insert(admins).values({ guildId, userId }).onConflictDoNothing()
  },

  async remove(guildId: string, userId: string) {
    await db.delete(admins).where(and(eq(admins.guildId, guildId), eq(admins.userId, userId)))
  },
}
