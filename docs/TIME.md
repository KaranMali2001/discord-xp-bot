# Time convention — everything is IST

**All time calculation, bucketing, and user-facing formatting in this project uses India
Standard Time (IST, UTC+5:30, no DST).** The community is India-based; event windows,
attendance days, and announcements are all reasoned about in IST, so every derived
calendar value must be too. Never introduce a UTC day/clock into anything a user sees or
that lines up with an event.

## What "in IST" means concretely

- **Storage stays epoch seconds (UTC instants).** We do NOT store wall-clock strings or
  shift the stored instant. Every timestamp column is `integer` epoch seconds via
  [`nowSec()`](../packages/core/src/util/time.ts). Only *derived* calendar values (day
  buckets, day-of-week, minute-of-day, formatted strings) are computed in IST.
- **Day buckets → `istDay(atSec)`** — `yyyy-mm-dd` in IST. Used by `event_attendance` and
  `event_voice_stats` so a late-evening talk never splits across two day-rows. Do **not**
  use `utcDay()` for anything user-facing or event-aligned.
- **Recurring windows / day-of-week / minute-of-day → `localClock(atSec)`** — IST dow +
  minute-since-IST-midnight. This is how event schedules are evaluated.
- **Parsing user input → `istWallClockToEpochSec(str)`** — a wall-clock the user types is
  IST; this maps it to the correct UTC instant.
- **Displaying a timestamp → `formatIst(atSec)`** — renders `YYYY-MM-DD HH:MM IST`.

All helpers live in [`packages/core/src/util/time.ts`](../packages/core/src/util/time.ts)
and derive from `IST_OFFSET_MIN = 330`.

## Rule for new code

When you need a calendar day, day-of-week, hour, or a displayed time, reach for the IST
helper — `istDay` / `localClock` / `formatIst` / `istWallClockToEpochSec`. `utcDay` /
`utcClock` remain only as the primitives those IST helpers are built on; don't call them
directly in feature code.
