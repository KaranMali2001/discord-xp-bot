# Voice Attendance Analytics — Accuracy Investigation & Logging Plan

**Branch context:** observed on production, written 2026-07-18
**Status:** investigating — logging not yet added
**Related:** [postgres-migration-plan.md](./postgres-migration-plan.md) (the crash-loop incident is a prime suspect), commits `f96cef7` / `ff68ca2` (the attendance/duration feature)

---

## 1. The symptom

The live **Attendance** dashboard for a recent event shows numbers that contradict what
we know happened in the room. From the screenshot:

| Member    | Stayed  | Unmuted | Muted   | Talk time | Days |
|-----------|---------|---------|---------|-----------|------|
| slug      | 45m02s  | 0s      | 45m02s  | 0s        | 1    |
| Karan5599 | 43m03s  | 37m03s  | 6m00s   | 18m00s    | 1    |
| Priyanshu | 30m02s  | 28m02s  | 2m00s   | **19m01s**| 1    |
| Agam      | 28m02s  | 0s      | 28m02s  | 0s        | 1    |
| …         |         |         |         |           |      |
| Sameer    | **5m00s**| 1m00s  | 4m00s   | 0s        | 1    |
| Namra     | **5m00s**| 0s      | 5m00s   | 0s        | 1    |
| Saumya    | **4m00s**| 1m00s  | 3m00s   | 2m00s     | 1    |
| Abhiran   | **6m00s**| 2m00s  | 4m00s   | 1m00s     | 1    |

Two distinct problems, confirmed by the human observer:

1. **"Stayed" is under-counted for passive attendees.** Saumya, Abhiran, Sameer, and
   Namra sat through the whole (~45 min) session but show 4–6 minutes. They may not have
   *talked*, but they were *present* the entire time.
2. **"Talk time" is over-counted for some speakers.** Priyanshu shows 19m01s of talk
   time; the observer doubts he spoke for anywhere near that long. (Agam's `0s` talk time
   is correct — he genuinely didn't talk.)

A tell-tale detail: the under-counted rows are all **round minutes** (`5m00s`, `6m00s`,
`4m00s`), while the correct rows carry odd seconds (`45m02s`, `43m03s`, `28m02s`). Round
numbers mean *few ticks were ever recorded* for those users; the `02s`/`03s` on the good
rows is `setInterval` drift accumulated over dozens of ticks. So the passive attendees
weren't billed a partial amount — **they were simply absent from the tick loop for most
of the event.**

---

## 2. How the pipeline works today

Understanding both bugs requires the data flow. Nothing here is written to the DB directly
from Discord events — everything funnels through an in-memory session map and a timer.

### 2.1 Session lifecycle (in memory)

- **`sessions: Map<"guildId:userId", VoiceSession>`** in
  [tracker.ts](../packages/bot/src/voice/tracker.ts) is the source of truth for "who is in
  voice right now." Each session holds `channelId`, `muted`, `spokeThisTick`, and
  `lastAccountedAt` (epoch seconds we last billed them up to).
- Sessions are created/updated by **`voiceStateUpdate`**
  ([voice-state-update.ts](../packages/bot/src/events/voice-state-update.ts)): join / move /
  mute-toggle → `tracker.upsert`; leave (`newState.channel == null`) → `tracker.remove`.
- At process start, **`seedVoiceSessions`** ([tick.ts:53](../packages/bot/src/voice/tick.ts#L53))
  walks `guild.voiceStates.cache` once and upserts everyone already connected — because no
  `voiceStateUpdate` fires for people who were in voice *before the bot logged in*.

### 2.2 The bill tick (every `XP_TICK_SECONDS`, prod = 60)

The `setInterval` at [tick.ts:93](../packages/bot/src/voice/tick.ts#L93) iterates
`tracker.all()` and for each session:

```
elapsed = min(now - lastAccountedAt, XP_TICK_SECONDS * 2)   // capped at 2 ticks
lastAccountedAt = now
recordDuration({ seconds: elapsed, muted, spoke })          // ALWAYS (even if muted)
if (present) grantTick(...)                                  // XP, skipped if muted+ignoreMuted
```

- **"Stayed" (`presentSeconds`)** = the sum of `elapsed` folded in by
  [`recordDuration`](../packages/core/src/domains/voice/voice.service.ts#L72) every tick.
  **Duration is only recorded if `effectiveMultiplier` resolves at least one
  `attendanceEventId`** — i.e. an attendance-counting event is active on that channel right
  now ([rules.service.ts:63](../packages/core/src/domains/rules/rules.service.ts#L63)).
- **"Muted"** = ticks where the session's `muted` flag was set. **"Unmuted"** = `Stayed − Muted`.
- **"Talk time" (`speakingSeconds`)** = ticks where `spoke` was true.

### 2.3 How `spoke` gets set — and why Talk time inflates

`spokeThisTick` is flipped to `true` the moment the voice receiver emits a **single**
`speaking → start` event ([tracker.ts:135](../packages/bot/src/voice/tracker.ts#L135)). The
bill tick then credits the **entire tick** (60s in prod) as speaking:

```ts
speakingSeconds: tick.spoke ? tick.seconds : 0   // voice.service.ts:89 — whole tick, not real audio duration
```

This is the documented "whole-tick billing" decision (good enough for XP), but it makes
**"Talk time" a wildly coarse metric**: one 1-second "yeah" inside a 60-second window
records **60 seconds** of talk time. Someone who chimed in once per minute for 19 different
minutes shows `19m` of talk time despite maybe 30 seconds of real audio. **This fully
explains Priyanshu's 19m01s** and is a *design artifact, not a data-loss bug.*

---

## 3. Hypotheses for the under-counted "Stayed"

Ranked by how well each explains "passive attendees lost ~90% of their time while talkers
were fine." We cannot currently confirm any of them from prod logs — that's the gap this
doc closes (§4).

### H1 — Crash-loop wiped the in-memory sessions repeatedly ✅ CONFIRMED ON PROD (2026-07-18)

**SSH'd into the VPS (`root@72.61.239.32`) and confirmed this is the cause.** Findings:

- `docker-xp-bot-bot-1` had **`RestartCount=140`** and was **`Exited (1)` — the bot had been
  fully DOWN for ~14 hours** (api + web still up). Docker's restart policy exhausted and gave up.
- The container was created ~23h earlier; the crash loop began **10s after first boot** and ran
  **10:22 → 18:49 UTC** (~8.5h, ~140 cycles), each cycle: `boot → seeded N members → crash ~60s later`.
- Every crash is the exact stack the migration plan predicted:
  ```
  Error: Hrana(Api("status=404 ... stream not found: 9a5bd1ce:..."))
      at Object.getConfig (packages/core/src/domains/rules/rules.dao.ts:14)
      at Object.getConfig (packages/core/src/domains/rules/rules.service.ts:37)
      at Timeout._onTimeout (packages/bot/src/voice/tick.ts:96)   ← const cfg = rulesService.getConfig(s.guildId)
  ```
- **Key asymmetry confirmed:** the `reconcile` loop hits the *same* wedged-stream error but
  **survives** (its body is inside try/catch → logs `❌ [reconcile] …` and continues). The **bill
  tick at [tick.ts:96](../packages/bot/src/voice/tick.ts#L96) is NOT guarded**, so it becomes an
  uncaught exception and kills the process. This is the single defect.
- The stream wedges within ~10s of idle, so each ~60s lifetime recorded **at most one** duration
  tick — and usually crashed on the *first* tick (line 96 runs before any `recordDuration`), so most
  lifetimes recorded **zero**. Each restart re-seeds only whoever is in `voiceStates.cache` at that
  instant (`seeded 16`, then `15`, …). Passive listeners drift out → 4–6 min of a 45-min session.
- Turso was reachable from the box during the check (HTTP response in 0.08s) — **the DB is not
  down; this is purely idle stream-expiry + the unguarded timer.**

**Event timeline reconstructed from the retained container log (all times UTC, 2026-07-17):**

| Time (UTC)    | Seeded members | What was happening |
|---------------|----------------|--------------------|
| 10:22–~16:00  | ~6             | Deploy DOA — crash-looped from 10s after first boot; voice tracking never worked in this deployment |
| **16:47**     | 2              | Event attendees start arriving |
| 16:55 → 17:13 | 15 → 24 → 30   | Ramp-up |
| **17:21–18:05** | **31–33 (peak)** | **The event proper — bot crash-looping every ~60s the entire time** |
| 18:13 → 18:44 | 29 → 24 → 18   | Wind-down |
| **18:49**     | —              | 140th restart; Docker restart policy exhausted → **bot dead ever since** |

- The screenshot's event is this **16:47–18:44 UTC (~22:17–00:14 IST)** window. Seeding *worked*
  (`seeded 32`), so the bot knew about the 30+ attendees — but each ~60s lifetime crashed at/near
  its first bill tick, so only a fraction of ticks ever persisted. ~45 min recorded across a ~120 min
  event ≈ ~37% tick landing rate for the best-tracked users; passive listeners (seeded in fewer
  lifetimes as they drifted out of the voice-state cache) landed 4–6 min.
- **Physical corroboration:** the `discord-xp-bot_audio` volume holds **1.1 GB** of capture — the
  transcript sessions the crashing bot left behind. (The migration plan's earlier incident fragmented
  a session into 85 one-minute folders; same root cause, different day.)

Original reasoning (still valid):


[postgres-migration-plan.md](./postgres-migration-plan.md) documents that during a recent
event the bot **crash-looped ~130 times (86 during a single event)** because a wedged Turso
Hrana stream threw inside the bare `setInterval` in `tick.ts`, killing the process. Every
crash:

- **wipes the `sessions` map** (it's in-memory), and
- loses every `voiceStateUpdate` that fires while the process is down.

On restart, `seedVoiceSessions` re-seeds everyone in voice **at that instant** with
`lastAccountedAt = now`. So the mechanism that produces per-user divergence is:

> **A passive listener who never toggles mute/deaf and never speaks generates no
> `voiceStateUpdate`.** If they are missing from `voiceStates.cache` at the exact moment
> `seedVoiceSessions` runs (the gateway may not have delivered all voice states yet on a
> fast restart), they stay invisible until the *next* restart happens to catch them.
> Active talkers toggle mute constantly → each toggle re-registers them within one tick of
> every restart → they lose almost nothing.

This matches the data precisely: the silent stayers (Saumya/Sameer/Namra) are exactly the
under-counted rows; the mute-togglers/talkers (Karan, Priyanshu) are fine. It also explains
the round-minute totals — those users were only in the tick loop for a handful of ticks
total across the whole fragmented event.

### H2 — `seedVoiceSessions` runs before the voice-state cache is populated

Independent of crashes: `seedVoiceSessions` reads `guild.voiceStates.cache` **once**. If it
fires before the gateway has hydrated that cache (READY vs. GUILD_CREATE timing), members
already in voice are silently skipped and never tracked until they themselves emit an event.
The `seeded N member(s)` log ([tick.ts:68](../packages/bot/src/voice/tick.ts#L68)) prints a
count but **not who**, so we can't tell if it seeded 3 of 20 people.

### H3 — Duration silently stops when the event window closes / channel mismatch

`recordDuration` records nothing when `effectiveMultiplier` returns no `attendanceEventIds`
— e.g. the event's configured `startMinute/endMinute` (IST) ended earlier than people
actually stayed, or the event is pinned to a `channelId` that differs from where people
actually sat. This would truncate *everyone* at the same wall-clock moment, so it explains a
global cap better than per-user divergence — but it's cheap to rule out and worth logging.

### H4 — Leave-before-tick loses the trailing partial tick

`tracker.remove` on leave discards the un-billed `now - lastAccountedAt` (up to 60s). Real,
but bounded to <1 tick per person — cannot account for 40 missing minutes. Noted for
completeness only.

**Working conclusion:** H1 is almost certainly the dominant cause and is *already being
fixed structurally* by the Postgres migration's Phase 0 (wrap the timer bodies so a DB throw
can't kill the process). But we should **prove it with logs** and harden the seed/tracking
path regardless, because any future crash or gateway hiccup will silently corrupt analytics
again.

---

## 4. Logging to add (the actual ask)

Goal: make the next event **self-diagnosing** — from logs alone we should be able to
reconstruct who was tracked, when the tick loop skipped them, and every process
restart. All new lines are cheap and belong at `info`/`warn` (prod runs `LOG_LEVEL=info`,
so today's `log.debug` speaking/grant lines are invisible in prod — see §5).

### 4.1 Process lifecycle — prove/disprove the crash-loop (H1)

Add a startup banner and a graceful-shutdown line so restarts are countable in the log
stream, and correlate with a monotonic boot id.

- **On boot** (bot `index.ts`): `log.info('boot', 'bot online — pid=<pid>, commit=<sha>, startedAt=<iso>')`.
- **On any uncaught exception / unhandledRejection**: `log.fatal('boot', 'crashing: <err>')`
  *before* exit, so the last line before each Docker restart names the cause.
- Wrap the two `setInterval` bodies in [tick.ts](../packages/bot/src/voice/tick.ts) in
  try/catch that logs `log.error('voice', 'tick failed: <err>')` and **continues** — this is
  the durable fix (a DB throw must never kill the loop). Coordinate with Phase 0 of the
  Postgres plan so we don't do it twice.

### 4.2 Seed visibility (H1/H2)

In [`seedVoiceSessions`](../packages/bot/src/voice/tick.ts#L53), log **who** was seeded and
whether the cache looked suspiciously empty:

- `log.info('voice', 'seed: guild=<id> voiceStates.cache=<N> seeded=<M> → [name, name, …]')`
- If `guild.members.cache` shows people the seed missed, that's the H2 fingerprint.

### 4.3 Per-tick roster + skip reasons (H1/H2/H3)

Once per bill tick, emit one summary line so we can see the tracked population over time and
catch the moment someone falls out of it:

- `log.info('voice', 'tick: tracked=<N> present=<P> recording=<R> [event=<eventId>|NO_ACTIVE_EVENT]')`
  where `recording` = sessions for which `recordDuration` actually found an
  `attendanceEventId`. A drop from `tracked=20` to `tracked=6` across a restart, or
  `recording=0` while `tracked>0`, immediately pinpoints H1 vs H3.
- When `recordDuration` finds **no** `attendanceEventId` for a session, log once per tick at
  `warn`: `log.warn('voice', 'no attendance event for <name> in <channelId> — duration NOT recorded')`
  ([voice.service.ts:72](../packages/core/src/domains/voice/voice.service.ts#L72)). This is
  the direct H3 detector.

### 4.4 Session add/remove churn (H1/H4)

Promote the join/leave lines to always name the user and reason, and add a periodic count so
churn is visible:

- On `tracker.remove`, log the un-billed remainder we're about to drop:
  `log.info('voice', '<name> left — dropping <sec>s un-billed (H4)')`.
- On `tracker.upsert` **new** vs **existing**, distinguish them — a burst of "new" sessions
  right after a boot banner is the crash-loop re-seeding.

### 4.5 Real speaking duration (H-Talktime, §2.3)

To later *fix* Talk time (not just diagnose it), we need real audio duration, which requires
listening to `speaking → end` in addition to `start`
([tracker.ts:135](../packages/bot/src/voice/tracker.ts#L135)) and accumulating
`end - start` per user per tick. For now, at minimum log both edges at `info` during events:

- `log.info('voice', '🗣️ <name> spoke <ms>ms')` on `speaking end`, so we can compare *real*
  audio time against the whole-tick `speakingSeconds` the dashboard shows.

---

## 5. Prod log level gotcha

Production runs **`LOG_LEVEL=info`** (`.env`). The most useful existing voice lines are
`log.debug`:

- `🗣️ speaking: <userId>` ([tracker.ts:136](../packages/bot/src/voice/tracker.ts#L136))
- per-tick XP grants ([tick.ts:130](../packages/bot/src/voice/tick.ts#L130))

These **never print in prod**, which is a big part of why this event is hard to reconstruct
after the fact. Options:

1. Put the new diagnostic lines in §4 at `info`/`warn` (recommended — always on, low volume:
   one summary line per 60s tick).
2. Temporarily set `LOG_LEVEL=debug` for the next event to capture per-utterance detail.

The logger has no `fatal`/`trace` methods exported even though the levels exist
([log.ts:16](../packages/bot/src/lib/log.ts#L16)) — add `fatal` before using it in §4.1.

---

## 6. Proposed sequence

1. **Add the logging in §4.1–§4.4 at `info`/`warn`** and deploy. Low-risk, no behaviour change.
2. **Contain the tick loop (§4.1 try/catch)** — merge with Postgres Phase 0; this stops the
   crash-loop from silently deleting attendance data going forward. *(Highest-value fix.)*
3. **Run the next event** and read the logs: confirm H1 (restart count + tracked-roster
   drops) vs H2 (seed misses) vs H3 (`NO_ACTIVE_EVENT` / channel mismatch).
4. **Harden seeding** (re-seed on `Ready`/reconnect, not only first boot) so a restart can't
   orphan silent listeners.
5. **Fix Talk time** separately (§4.5): switch `speakingSeconds` from whole-tick to real
   `speaking start→end` accumulation so the column reflects actual audio.

---

## 7. Open questions

- What was `XP_TICK_SECONDS` in prod during this event — 60? (Confirms round-minute math.)
- Do we have the raw process/Docker logs for the event window to count restarts directly,
  or only the dashboard output?
- Was the event configured with a specific `channelId`, and did people sit in exactly that
  channel? (Rules out H3 cheaply.)
- Is `ignoreMutedVoice` still `true`? (It is by default — affects XP but not "Stayed",
  which records regardless of mute.)
