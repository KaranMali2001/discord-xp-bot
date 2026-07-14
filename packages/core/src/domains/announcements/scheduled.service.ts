import { type ScheduledAnnouncementInput, scheduledAnnouncementInput } from './announcements.schema'
import { announcementsService } from './announcements.service'
import { type ScheduledAnnouncement, scheduledDao } from './scheduled.dao'

/**
 * Scheduled (one-off) announcements. Callers (the dashboard API and the `/announce`
 * command) create rows here; the bot's scheduler tick drains due rows through
 * `runDue`, which reuses the immediate-send path so delivery is identical.
 */
export const scheduledAnnouncementsService = {
  /** Validate + persist a scheduled announcement. Throws ZodError on bad input. */
  schedule(
    guildId: string,
    createdBy: string,
    raw: ScheduledAnnouncementInput,
  ): ScheduledAnnouncement {
    const input = scheduledAnnouncementInput.parse(raw)
    return scheduledDao.create({
      guildId,
      channelId: input.channelId,
      message: input.message,
      memberIds: input.memberIds,
      roleIds: input.roleIds,
      mentionEveryone: input.mentionEveryone,
      fireAt: input.fireAt,
      createdBy,
    })
  },

  listUpcoming(guildId: string): ScheduledAnnouncement[] {
    return scheduledDao.listUpcoming(guildId)
  },

  cancel(guildId: string, id: number): boolean {
    return scheduledDao.cancel(guildId, id)
  },

  /** Skip-missed sweep, run once at bot startup. Returns how many were marked missed. */
  sweepMissed(before?: number): number {
    return scheduledDao.sweepMissed(before)
  },

  /**
   * Post every due announcement and mark it sent. A single row's failure is isolated
   * (logged via onError) so one bad channel doesn't stall the rest of the batch.
   */
  async runDue(
    at?: number,
    onError?: (a: ScheduledAnnouncement, err: unknown) => void,
  ): Promise<ScheduledAnnouncement[]> {
    const due = scheduledDao.listDue(at)
    const sent: ScheduledAnnouncement[] = []
    for (const a of due) {
      try {
        await announcementsService.send({
          channelId: a.channelId,
          message: a.message,
          memberIds: a.memberIds,
          roleIds: a.roleIds,
          mentionEveryone: a.mentionEveryone,
        })
        scheduledDao.markSent(a.id)
        sent.push(a)
      } catch (err) {
        onError?.(a, err)
      }
    }
    return sent
  },
}
