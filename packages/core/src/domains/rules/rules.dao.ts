import { and, eq } from 'drizzle-orm'
import { db } from '../../db/client'
import {
  channelRules,
  eventTargetMembers,
  guildConfig,
  levelRewards,
  multiplierEvents,
} from '../../db/schema'
import { nowSec } from '../../util/time'
import type {
  ChannelRuleInput,
  EventInput,
  GuildConfigInput,
  LevelRewardInput,
} from './rules.schema'

type EventRow = typeof multiplierEvents.$inferSelect
export type EventWithTargets = EventRow & { targetUserIds: string[] }

function splitEventInput<T extends Partial<EventInput>>(input: T) {
  const { targetUserIds, ...event } = input
  return { event, targetUserIds }
}

function uniqueUserIds(userIds: string[]) {
  return [...new Set(userIds)]
}

async function attachEventTargets(rows: EventRow[]): Promise<EventWithTargets[]> {
  if (rows.length === 0) return []
  const guildId = rows[0]!.guildId
  const targets = await db
    .select()
    .from(eventTargetMembers)
    .where(eq(eventTargetMembers.guildId, guildId))

  return rows.map((row) => ({
    ...row,
    targetUserIds: targets.filter((t) => t.eventId === row.id).map((t) => t.userId),
  }))
}

async function replaceEventTargets(guildId: string, eventId: number, userIds: string[]) {
  await db
    .delete(eventTargetMembers)
    .where(and(eq(eventTargetMembers.guildId, guildId), eq(eventTargetMembers.eventId, eventId)))

  const unique = uniqueUserIds(userIds)
  if (unique.length === 0) return
  await db.insert(eventTargetMembers).values(
    unique.map((userId) => ({
      guildId,
      eventId,
      userId,
    })),
  )
}

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
    const rows = await db
      .select()
      .from(multiplierEvents)
      .where(eq(multiplierEvents.guildId, guildId))
    return attachEventTargets(rows)
  },

  async createEvent(guildId: string, input: EventInput) {
    const { event, targetUserIds } = splitEventInput(input)
    const [row] = await db
      .insert(multiplierEvents)
      .values({ guildId, ...event })
      .returning()
    if (row && targetUserIds) await replaceEventTargets(guildId, row.id, targetUserIds)
    if (!row) return row
    return { ...row, targetUserIds: targetUserIds ? uniqueUserIds(targetUserIds) : [] }
  },

  async updateEvent(guildId: string, id: number, input: Partial<EventInput>) {
    const { event, targetUserIds } = splitEventInput(input)
    const [row] = await db
      .update(multiplierEvents)
      .set(event)
      .where(and(eq(multiplierEvents.guildId, guildId), eq(multiplierEvents.id, id)))
      .returning()
    if (row && targetUserIds) await replaceEventTargets(guildId, id, targetUserIds)
    if (!row) return row
    const [withTargets] = await attachEventTargets([row])
    return withTargets
  },

  async deleteEvent(guildId: string, id: number) {
    await replaceEventTargets(guildId, id, [])
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
