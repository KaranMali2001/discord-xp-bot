import { z } from 'zod'
import { nowSec } from '../../util/time'

/**
 * A composed announcement: free-text body plus the members and roles to ping.
 * Mentions are supplied as explicit id lists (from the dashboard pickers or the
 * bot's select menus) so we never rely on parsing raw text for who to notify.
 */
export const announcementInput = z.object({
  channelId: z.string().min(1),
  // Discord's hard limit is 2000 chars; leave headroom for the mentions line.
  message: z.string().trim().min(1).max(1900),
  memberIds: z.array(z.string().min(1)).max(50).default([]),
  roleIds: z.array(z.string().min(1)).max(25).default([]),
  mentionEveryone: z.boolean().default(false),
})

export type AnnouncementInput = z.infer<typeof announcementInput>

/** Reject schedules that fire too soon to be meaningful (or already in the past). */
export const MIN_LEAD_SEC = 60

/** A one-off scheduled announcement: the same payload plus an epoch fire time. */
export const scheduledAnnouncementInput = announcementInput
  .extend({
    fireAt: z.number().int().positive(),
  })
  .refine((v) => v.fireAt >= nowSec() + MIN_LEAD_SEC, {
    message: `fireAt must be at least ${MIN_LEAD_SEC}s in the future`,
    path: ['fireAt'],
  })

export type ScheduledAnnouncementInput = z.infer<typeof scheduledAnnouncementInput>
