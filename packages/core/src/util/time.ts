/** Epoch seconds (integer) — the unit we store all timestamps in. */
export function nowSec(): number {
  return Math.floor(Date.now() / 1000)
}

/** UTC yyyy-mm-dd for a given epoch-seconds instant (default: now). */
export function utcDay(atSec: number = nowSec()): string {
  return new Date(atSec * 1000).toISOString().slice(0, 10)
}

/** Minutes since UTC midnight, and UTC day-of-week (0=Sun..6=Sat). */
export function utcClock(atSec: number = nowSec()): { dow: number; minute: number } {
  const d = new Date(atSec * 1000)
  return { dow: d.getUTCDay(), minute: d.getUTCHours() * 60 + d.getUTCMinutes() }
}

/**
 * India Standard Time offset (UTC+5:30, no DST). Recurring event windows are defined
 * and evaluated in IST — see localClock / EventsTab.
 */
export const IST_OFFSET_MIN = 330

/** Minutes since IST midnight, and IST day-of-week (0=Sun..6=Sat). */
export function localClock(atSec: number = nowSec()): { dow: number; minute: number } {
  // Shifting the instant forward by the offset makes its UTC wall-clock read as IST.
  return utcClock(atSec + IST_OFFSET_MIN * 60)
}
