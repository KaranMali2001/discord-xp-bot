import { formatIst, scheduledAnnouncementsService } from '@xp/core'
import { log } from '../lib/log'

const POLL_MS = 30_000

/**
 * Skip-missed policy: at startup, mark any pending announcement whose time already
 * passed while the bot was offline as `missed` — it is never posted late.
 */
export function sweepMissedAnnouncements(): void {
  const missed = scheduledAnnouncementsService.sweepMissed()
  if (missed > 0) {
    log.warn('announce', `${missed} scheduled announcement(s) were due while offline — skipped`)
  }
}

/**
 * Poll every POLL_MS for scheduled announcements whose time has arrived and post them
 * through the shared announcements service. Since the bot runs continuously, anything
 * sent here is at most one poll late.
 */
export function startAnnouncementTick(): NodeJS.Timeout {
  return setInterval(async () => {
    const sent = await scheduledAnnouncementsService.runDue(undefined, (a, err) => {
      log.error('announce', `scheduled #${a.id} failed to post: ${(err as Error).message}`)
    })
    for (const a of sent) {
      log.info('announce', `posted scheduled #${a.id} (due ${formatIst(a.fireAt)})`)
    }
  }, POLL_MS)
}
