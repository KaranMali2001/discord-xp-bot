import {
  announcementInput,
  announcementsService,
  scheduledAnnouncementInput,
  scheduledAnnouncementsService,
} from '@xp/core'
import { invalidateBotCache } from '../lib/cache-invalidate'
import { parse } from '../lib/validate'

export const announcementsController = {
  /** Validate the compose form and post the announcement immediately via core. */
  async send(body: unknown) {
    const input = parse(announcementInput, body)
    return announcementsService.send(input)
  },

  /** Validate + persist a one-off scheduled announcement. */
  async schedule(guildId: string, createdBy: string, body: unknown) {
    const input = parse(scheduledAnnouncementInput, body)
    const row = await scheduledAnnouncementsService.schedule(guildId, createdBy, input)
    // Wake the bot's scheduler gate so the new row fires on time, not at the next backstop (§2.1).
    invalidateBotCache(guildId, 'announcements')
    return row
  },

  listScheduled(guildId: string) {
    return scheduledAnnouncementsService.listUpcoming(guildId)
  },

  async cancelScheduled(guildId: string, id: number) {
    const ok = await scheduledAnnouncementsService.cancel(guildId, id)
    if (ok) invalidateBotCache(guildId, 'announcements')
    return { ok }
  },
}
