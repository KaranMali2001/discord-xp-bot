import {
  announcementInput,
  announcementsService,
  scheduledAnnouncementInput,
  scheduledAnnouncementsService,
} from '@xp/core'
import { parse } from '../lib/validate'

export const announcementsController = {
  /** Validate the compose form and post the announcement immediately via core. */
  async send(body: unknown) {
    const input = parse(announcementInput, body)
    return announcementsService.send(input)
  },

  /** Validate + persist a one-off scheduled announcement. */
  schedule(guildId: string, createdBy: string, body: unknown) {
    const input = parse(scheduledAnnouncementInput, body)
    return scheduledAnnouncementsService.schedule(guildId, createdBy, input)
  },

  listScheduled(guildId: string) {
    return scheduledAnnouncementsService.listUpcoming(guildId)
  },

  cancelScheduled(guildId: string, id: number) {
    return { ok: scheduledAnnouncementsService.cancel(guildId, id) }
  },
}
