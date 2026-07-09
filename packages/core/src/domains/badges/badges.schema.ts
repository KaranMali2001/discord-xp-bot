import { z } from 'zod'

export const BADGE_CRITERIA = [
  'level',
  'messages',
  'voice_minutes',
  'speaking_minutes',
  'fridays_attended',
] as const

export const badgeInput = z.object({
  key: z
    .string()
    .min(1)
    .max(40)
    .regex(/^[a-z0-9_-]+$/, 'lowercase letters, numbers, - and _ only'),
  name: z.string().min(1).max(80),
  description: z.string().max(300).default(''),
  emoji: z.string().max(16).default('🏅'),
  criteria: z.enum(BADGE_CRITERIA),
  threshold: z.number().int().min(1),
})
export type BadgeInput = z.infer<typeof badgeInput>
