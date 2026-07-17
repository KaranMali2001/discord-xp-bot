# Voice attendance duration tracking — per event-day accumulator

## Status

accepted

## Context & Decision

The bot already joins an event's voice channel, boosts XP, and records **binary attendance**
(`event_attendance`: one row per member/event/day = "showed up"). For the event dashboard we
now also want to know **how long each person stayed**, split into **unmuted**, **muted**, and
**actual talk time**. None of that existed:

- `members.voiceSeconds` / `members.speakingSeconds` are **all-time cumulative** counters on
  the member row — not per event, not per session. They can't answer "how long did Alice stay
  in last Friday's talk".
- **Muted time was discarded entirely**: the XP tick did `continue` on
  `muted && ignoreMutedVoice`, so those seconds were never billed or recorded anywhere.

### Decision

A new **`event_voice_stats`** table keyed **per `(guildId, userId, eventId, day)`** accumulates
durations. Chosen properties:

- **Rejoins accumulate into the same row.** A disconnect + rejoin during the same event-day
  hits the same PK and just increments the counters — matching "total time stayed". Time spent
  disconnected is never counted: the tracker drops the in-memory session on leave and resets
  `lastAccountedAt` on rejoin, so the gap is never billed (the existing
  `Math.min(elapsed, XP_TICK_SECONDS * 2)` clamp is a second guard).
- **Three stored counters**, minimal and non-redundant: `presentSeconds` (total in VC),
  `mutedSeconds`, `speakingSeconds`. Unmuted is derived (`present − muted`).
- **Duration is recorded every tick, decoupled from the XP grant.** The bot tick now calls
  `voiceService.recordDuration()` on *every* tick — including muted ticks that `grantTick`
  skips — so muted time is captured. XP is still only granted when present.
- **Same event resolution as XP.** `recordDuration` resolves active attendance events via the
  existing `rulesService.effectiveMultiplier`, so a no-XP channel records no duration and the
  numbers stay consistent with the binary attendance already written by `grantTick`.

**Data flow:** bot tick → `voiceService.recordDuration` → `voiceDao.recordActivity`
(`onConflictDoUpdate` incrementing counters) → dashboard reads via
`GET /api/guilds/:id/events/:eventId/attendance` → `voiceService.statsForEvent` (per-user
totals summed across every day the event ran) → new **Attendance** tab in the web dashboard.

**Speaking granularity** is intentionally tick-level (reusing the existing `spokeThisTick`
flag from the voice receiver): if a member transmits at all during a tick, the whole tick
counts as talk time. This overcounts short utterances but needs zero extra plumbing and is
sufficient for a "who talked vs lurked" view. True per-utterance duration (available from the
capture layer) is a possible future refinement.

### Consequences / limitations

- **Additive migration only** (`0005_*.sql`, a brand-new table) — zero risk to existing data,
  no backfill; durations accrue from first deploy. Applied automatically by the deploy
  pipeline / docker-compose `migrate` step against Turso before boot.
- **Event-scoped by design.** Presence outside an attendance-counting event (and manual voice
  captures with no associated `multiplier_event`) records no duration row. This matches the
  "track the event" ask; a general per-session log would be a different shape.
- No `joinCount` yet — rejoins are summed but not counted separately. Easy follow-up if the
  dashboard ever needs "rejoined N×".
