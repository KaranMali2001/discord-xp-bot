# Targeted event XP boosters

## Status

accepted

## Context & Decision

Multiplier events currently apply to a whole guild, or to everyone in one channel when
`multiplier_events.channel_id` is set. That works for community-wide event boosts, but not
for cases where admins want to boost only specific members during an event.

### Decision

Add an event target-member list. An event with no target members keeps the existing behavior
and applies to everyone. An event with one or more target members applies its XP multiplier
only to those user IDs.

Chosen storage:

- A normalized `event_target_members` table keyed by `(guildId, eventId, userId)`.
- `multiplier_events` remains the event definition table.
- The API accepts `targetUserIds` when creating or patching events and returns each event with
  the same list.

This keeps the hot XP path simple: `xpService.grant(...)` passes the member's `userId` into
`rulesService.effectiveMultiplier(...)`; active events are considered only when either their
target set is empty or it contains that user. Channel rules and event multipliers continue to
stack multiplicatively.

### Attendance behavior

Targeted boosters are an XP scope, not an attendance scope. Attendance-duration recording can
still include every member in the event voice channel, because the attendance dashboard answers
"who attended and for how long" while the target-member list answers "who gets boosted XP".

### Consequences / limitations

- Existing events continue to behave exactly as before because they have no target rows.
- A normalized table is more verbose than a JSON column, but gives better validation,
  indexing, and future flexibility for bulk edits or additional target types.
- Role-based or cohort-based targeting is not included here. It can be added later as another
  target table or target kind without changing the base event model.
