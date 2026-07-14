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

/**
 * Parse an IST wall-clock ("YYYY-MM-DD HH:MM", or with a 'T' separator) to epoch
 * seconds, or null if malformed / not a real calendar date. Used by scheduled
 * announcements so a time the user types in IST maps to the correct UTC instant.
 */
export function istWallClockToEpochSec(input: string): number | null {
  const m = input.trim().match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})$/)
  if (!m) return null
  const year = Number(m[1])
  const month = Number(m[2])
  const day = Number(m[3])
  const hour = Number(m[4])
  const minute = Number(m[5])
  if (hour > 23 || minute > 59 || month < 1 || month > 12 || day < 1 || day > 31) return null
  // Treat the wall-clock as if it were UTC, then subtract the IST offset for the real instant.
  const asUtc = Date.UTC(year, month - 1, day, hour, minute)
  const check = new Date(asUtc)
  // Reject rollovers (e.g. 2026-02-30 → Mar 2) so bad dates don't silently shift.
  if (check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return null
  return Math.floor(asUtc / 1000) - IST_OFFSET_MIN * 60
}

/** Format an epoch-seconds instant as an IST wall-clock string ("YYYY-MM-DD HH:MM IST"). */
export function formatIst(atSec: number): string {
  const d = new Date((atSec + IST_OFFSET_MIN * 60) * 1000)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} IST`
}
