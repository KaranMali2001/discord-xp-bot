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
  getConfig(guildId: string) {
    return db.select().from(guildConfig).where(eq(guildConfig.guildId, guildId)).get()
  },

  upsertConfig(guildId: string, patch: GuildConfigInput) {
    return db
      .insert(guildConfig)
      .values({ guildId, ...patch, updatedAt: nowSec() })
      .onConflictDoUpdate({
        target: guildConfig.guildId,
        set: { ...patch, updatedAt: nowSec() },
      })
      .returning()
      .get()
  },

  listChannelRules(guildId: string) {
    return db.select().from(channelRules).where(eq(channelRules.guildId, guildId)).all()
  },

  getChannelRule(guildId: string, channelId: string) {
    return db
      .select()
      .from(channelRules)
      .where(and(eq(channelRules.guildId, guildId), eq(channelRules.channelId, channelId)))
      .get()
  },

  upsertChannelRule(guildId: string, input: ChannelRuleInput) {
    return db
      .insert(channelRules)
      .values({ guildId, ...input })
      .onConflictDoUpdate({
        target: [channelRules.guildId, channelRules.channelId],
        set: { kind: input.kind, multiplier: input.multiplier, noXp: input.noXp },
      })
      .returning()
      .get()
  },

  deleteChannelRule(guildId: string, channelId: string) {
    db.delete(channelRules)
      .where(and(eq(channelRules.guildId, guildId), eq(channelRules.channelId, channelId)))
      .run()
  },

  listEvents(guildId: string) {
    return db.select().from(multiplierEvents).where(eq(multiplierEvents.guildId, guildId)).all()
  },

  createEvent(guildId: string, input: EventInput) {
    return db
      .insert(multiplierEvents)
      .values({ guildId, ...input })
      .returning()
      .get()
  },

  updateEvent(guildId: string, id: number, input: Partial<EventInput>) {
    return db
      .update(multiplierEvents)
      .set(input)
      .where(and(eq(multiplierEvents.guildId, guildId), eq(multiplierEvents.id, id)))
      .returning()
      .get()
  },

  deleteEvent(guildId: string, id: number) {
    db.delete(multiplierEvents)
      .where(and(eq(multiplierEvents.guildId, guildId), eq(multiplierEvents.id, id)))
      .run()
  },

  listLevelRewards(guildId: string) {
    return db.select().from(levelRewards).where(eq(levelRewards.guildId, guildId)).all()
  },

  upsertLevelReward(guildId: string, input: LevelRewardInput) {
    return db
      .insert(levelRewards)
      .values({ guildId, ...input })
      .onConflictDoUpdate({
        target: [levelRewards.guildId, levelRewards.level],
        set: { roleId: input.roleId },
      })
      .returning()
      .get()
  },

  deleteLevelReward(guildId: string, level: number) {
    db.delete(levelRewards)
      .where(and(eq(levelRewards.guildId, guildId), eq(levelRewards.level, level)))
      .run()
  },
}
