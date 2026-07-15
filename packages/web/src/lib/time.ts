/** "HH:MM" (24h) → minutes from midnight, or null when unparseable. */
export function hhmmToMinutes(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim())
  if (!match) return null
  const hours = Number(match[1])
  const mins = Number(match[2])
  if (hours < 0 || hours > 23 || mins < 0 || mins > 59) return null
  return hours * 60 + mins
}

/** minutes from midnight → "HH:MM" (24h). */
export function minutesToHhmm(total: number): string {
  const clamped = Math.max(0, Math.min(1440, total))
  const hours = Math.floor(clamped / 60)
  const mins = clamped % 60
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`
}

const IST_OFFSET_MIN = 330

/**
 * A <input type="datetime-local"> value ("YYYY-MM-DDTHH:MM") entered as IST wall-clock
 * → epoch seconds. Returns null if unparseable.
 */
export function istDateTimeLocalToEpochSec(value: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value.trim())
  if (!match) return null
  const y = Number(match[1])
  const mo = Number(match[2])
  const d = Number(match[3])
  const h = Number(match[4])
  const mi = Number(match[5])
  const asUtc = Date.UTC(y, mo - 1, d, h, mi)
  if (Number.isNaN(asUtc)) return null
  return Math.floor(asUtc / 1000) - IST_OFFSET_MIN * 60
}

/** Epoch seconds → "YYYY-MM-DD HH:MM IST" for display. */
export function formatIst(atSec: number): string {
  const d = new Date((atSec + IST_OFFSET_MIN * 60) * 1000)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} IST`
}

export const DAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const
