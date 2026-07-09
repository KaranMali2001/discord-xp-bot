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
