import { z } from 'zod'

export const guildConfigInput = z.object({
  messageXp: z.number().int().min(0).max(1000).optional(),
  messageCooldownSec: z.number().int().min(0).max(3600).optional(),
  voicePresenceXpPerMin: z.number().int().min(0).max(1000).optional(),
  voiceSpeakingXpPerMin: z.number().int().min(0).max(1000).optional(),
  ignoreMutedVoice: z.boolean().optional(),
  levelUpChannelId: z.string().nullable().optional(),
  levelUpMessage: z.string().max(500).optional(),
})
export type GuildConfigInput = z.infer<typeof guildConfigInput>

export const channelRuleInput = z.object({
  channelId: z.string().min(1),
  kind: z.enum(['text', 'voice']),
  multiplier: z.number().min(0).max(100).default(1),
  noXp: z.boolean().default(false),
})
export type ChannelRuleInput = z.infer<typeof channelRuleInput>

/** Base object — used for partial (PATCH) validation, which a refined schema can't do. */
export const eventBase = z.object({
  name: z.string().min(1).max(100),
  multiplier: z.number().min(0).max(100).default(2),
  enabled: z.boolean().default(true),
  countsAttendance: z.boolean().default(false),
  channelId: z.string().nullable().optional(),
  // recurring weekly
  dayOfWeek: z.number().int().min(0).max(6).nullable().optional(),
  startMinute: z.number().int().min(0).max(1439).nullable().optional(),
  endMinute: z.number().int().min(0).max(1440).nullable().optional(),
  // one-off
  startsAt: z.number().int().nullable().optional(),
  endsAt: z.number().int().nullable().optional(),
})

export const eventInput = eventBase.refine(
  (e) =>
    (e.dayOfWeek != null && e.startMinute != null && e.endMinute != null) ||
    (e.startsAt != null && e.endsAt != null),
  {
    message:
      'Provide either a recurring window (dayOfWeek+start/endMinute) or a one-off (startsAt+endsAt)',
  },
)
export type EventInput = z.infer<typeof eventInput>

export const levelRewardInput = z.object({
  level: z.number().int().min(1).max(1000),
  roleId: z.string().min(1),
})
export type LevelRewardInput = z.infer<typeof levelRewardInput>
