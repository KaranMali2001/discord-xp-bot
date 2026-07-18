import { and, eq } from 'drizzle-orm'
import { db } from '../../db/client'
import { channelRules, guildConfig, levelRewards, multiplierEvents } from '../../db/schema'
import { nowSec } from '../../util/time'
import type {
  ChannelRuleInput,
  EventInput,
  GuildConfigInput,
  LevelRewardInput,
} from './rules.schema'

export const rulesDao = {
  async getConfig(guildId: string) {
    const [row] = await db.select().from(guildConfig).where(eq(guildConfig.guildId, guildId))
    return row
  },

  async upsertConfig(guildId: string, patch: GuildConfigInput) {
    const [row] = await db
      .insert(guildConfig)
      .values({ guildId, ...patch, updatedAt: nowSec() })
      .onConflictDoUpdate({
        target: guildConfig.guildId,
        set: { ...patch, updatedAt: nowSec() },
      })
      .returning()
    return row
  },

  async listChannelRules(guildId: string) {
    return db.select().from(channelRules).where(eq(channelRules.guildId, guildId))
  },

  async getChannelRule(guildId: string, channelId: string) {
    const [row] = await db
      .select()
      .from(channelRules)
      .where(and(eq(channelRules.guildId, guildId), eq(channelRules.channelId, channelId)))
    return row
  },

  async upsertChannelRule(guildId: string, input: ChannelRuleInput) {
    const [row] = await db
      .insert(channelRules)
      .values({ guildId, ...input })
      .onConflictDoUpdate({
        target: [channelRules.guildId, channelRules.channelId],
        set: { kind: input.kind, multiplier: input.multiplier, noXp: input.noXp },
      })
      .returning()
    return row
  },

  async deleteChannelRule(guildId: string, channelId: string) {
    await db
      .delete(channelRules)
      .where(and(eq(channelRules.guildId, guildId), eq(channelRules.channelId, channelId)))
  },

  async listEvents(guildId: string) {
    return db.select().from(multiplierEvents).where(eq(multiplierEvents.guildId, guildId))
  },

  async createEvent(guildId: string, input: EventInput) {
    const [row] = await db
      .insert(multiplierEvents)
      .values({ guildId, ...input })
      .returning()
    return row
  },

  async updateEvent(guildId: string, id: number, input: Partial<EventInput>) {
    const [row] = await db
      .update(multiplierEvents)
      .set(input)
      .where(and(eq(multiplierEvents.guildId, guildId), eq(multiplierEvents.id, id)))
      .returning()
    return row
  },

  async deleteEvent(guildId: string, id: number) {
    await db
      .delete(multiplierEvents)
      .where(and(eq(multiplierEvents.guildId, guildId), eq(multiplierEvents.id, id)))
  },

  async listLevelRewards(guildId: string) {
    return db.select().from(levelRewards).where(eq(levelRewards.guildId, guildId))
  },

  async upsertLevelReward(guildId: string, input: LevelRewardInput) {
    const [row] = await db
      .insert(levelRewards)
      .values({ guildId, ...input })
      .onConflictDoUpdate({
        target: [levelRewards.guildId, levelRewards.level],
        set: { roleId: input.roleId, message: input.message ?? null },
      })
      .returning()
    return row
  },

  async deleteLevelReward(guildId: string, level: number) {
    await db
      .delete(levelRewards)
      .where(and(eq(levelRewards.guildId, guildId), eq(levelRewards.level, level)))
  },
}
