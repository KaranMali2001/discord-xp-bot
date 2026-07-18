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
  async schedule(
    guildId: string,
    createdBy: string,
    raw: ScheduledAnnouncementInput,
  ): Promise<ScheduledAnnouncement> {
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

  async listUpcoming(guildId: string): Promise<ScheduledAnnouncement[]> {
    return scheduledDao.listUpcoming(guildId)
  },

  /** Earliest pending fire time across all guilds (or null) — the scheduler's idle gate (§2.1). */
  async earliestPending(): Promise<number | null> {
    return scheduledDao.earliestPending()
  },

  async cancel(guildId: string, id: number): Promise<boolean> {
    return scheduledDao.cancel(guildId, id)
  },

  /** Skip-missed sweep, run once at bot startup. Returns how many were marked missed. */
  async sweepMissed(before?: number): Promise<number> {
    return scheduledDao.sweepMissed(before)
  },

  /**
   * Post every due announcement. Each row is CLAIMED atomically right before it's sent
   * (`claimOne` flips pending→sent guarded by status), so a second scheduler process can never
   * double-post the same announcement — the loser simply skips it. A single row's failure is
   * isolated (logged via onError) AND rolled back to `pending` so the next tick retries it,
   * rather than leaving it silently marked sent-but-not-posted.
   */
  async runDue(
    at?: number,
    onError?: (a: ScheduledAnnouncement, err: unknown) => void,
  ): Promise<ScheduledAnnouncement[]> {
    const due = await scheduledDao.listDue(at)
    const sent: ScheduledAnnouncement[] = []
    for (const a of due) {
      // Skip anything a concurrent scheduler already claimed (atomic pending→sent guard).
      if (!(await scheduledDao.claimOne(a.id))) continue
      try {
        await announcementsService.send({
          channelId: a.channelId,
          message: a.message,
          memberIds: a.memberIds,
          roleIds: a.roleIds,
          mentionEveryone: a.mentionEveryone,
        })
        sent.push(a)
      } catch (err) {
        await scheduledDao.releaseToPending(a.id).catch(() => {
          // best effort — if the rollback itself fails the startup sweep still catches it
        })
        onError?.(a, err)
      }
    }
    return sent
  },
}
