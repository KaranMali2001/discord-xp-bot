import { formatIst, nowSec, scheduledAnnouncementsService } from '@xp/core'
import { log } from '../lib/log'

const POLL_MS = 30_000
// Backstop re-sync of the earliest-pending time, in case a cross-process signal was lost while
// the bot was restarting (mirrors the config cache's 30-min backstop, §2.1).
const RESYNC_MS = 30 * 60 * 1000

/**
 * Earliest pending announcement (epoch seconds), kept IN MEMORY so an idle bot decides "nothing
 * due yet" without a DB query every 30s — the last always-on query source removed for Neon
 * scale-to-zero (§2.1). null = nothing pending. Updated at boot, after each posting tick, when a
 * write signals us (API → cache-sync, or this process's own /announce), and every RESYNC_MS.
 */
let nextAt: number | null = null

/** Re-read the earliest pending fire time from the DB (boot + backstop + after posting). */
export async function resyncSchedule(): Promise<void> {
  nextAt = await scheduledAnnouncementsService.earliestPending()
}

/** Fast local hint when THIS process schedules one (bot /announce) — skips a DB round-trip. */
export function noteScheduledAt(fireAt: number): void {
  if (nextAt === null || fireAt < nextAt) nextAt = fireAt
}

/**
 * Skip-missed policy: at startup, mark any pending announcement whose time already
 * passed while the bot was offline as `missed` — it is never posted late.
 */
export async function sweepMissedAnnouncements(): Promise<void> {
  const missed = await scheduledAnnouncementsService.sweepMissed()
  if (missed > 0) {
    log.warn('announce', `${missed} scheduled announcement(s) were due while offline — skipped`)
  }
}

/**
 * Poll every POLL_MS, but only touch the DB when the in-memory `nextAt` says something is
 * actually due — so an idle bot with no pending announcements issues ZERO queries (§2.1). When a
 * row is due we drain it via the shared service and recompute `nextAt`. A backstop re-sync every
 * RESYNC_MS repairs `nextAt` if a write signal was ever missed.
 */
export function startAnnouncementTick(): NodeJS.Timeout {
  // Seed the gate from the DB once at boot (after the startup sweep).
  void resyncSchedule().catch((e) => log.error('announce', `initial schedule sync failed: ${e}`))

  const resync = setInterval(() => {
    void resyncSchedule().catch((e) => log.error('announce', `schedule resync failed: ${e}`))
  }, RESYNC_MS)
  resync.unref?.()

  return setInterval(async () => {
    // Never let a transient DB throw escape the timer (Phase 0) — log + skip the tick.
    try {
      // Idle fast-path: nothing pending, or the earliest isn't due yet → no DB query this tick.
      if (nextAt === null || nowSec() < nextAt) return
      const sent = await scheduledAnnouncementsService.runDue(undefined, (a, err) => {
        log.error('announce', `scheduled #${a.id} failed to post: ${(err as Error).message}`)
      })
      for (const a of sent) {
        log.info('announce', `posted scheduled #${a.id} (due ${formatIst(a.fireAt)})`)
      }
      // Recompute the next fire time after draining due rows (a failed post is rolled back to
      // pending by runDue, so it reappears here and retries on the next tick).
      await resyncSchedule()
    } catch (e) {
      log.error('announce', `scheduled tick failed — skipping: ${e}`)
    }
  }, POLL_MS)
}
