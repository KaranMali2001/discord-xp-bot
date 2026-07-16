# Announcements — one shared send path, inline mentions, one-off scheduling

## Status

accepted

## Context & Decision

Managers need to post announcements — with member/role pings — to a channel, from **both**
the `/announce` slash command and the web dashboard, and optionally **schedule** them for
later.

We built it around **one shared `announcementsService.send()` in `core`** — the single place
that turns "channel + text + who to ping" into a posted Discord message, sent over Discord
REST with the bot token (same principle as [ADR 0001](0001-level-role-sync-pure-diff-applied-per-transport.md)).
Both surfaces call it, so behaviour and ping-gating can't drift.

- **Mentions, inline.** The dashboard uses a Discord-style `@`-composer (react-mentions):
  the manager types `@` and picks a member (server-searched) or role, inserting the mention
  **anywhere in the body**. The message is sent with `<@id>` / `<@&id>` markup embedded.
- **Allow-list from content.** `send()` derives `allowed_mentions` by **parsing the inline
  ids out of the message**, unioned with any explicit id lists (the slash command's select
  menus). Only the intended users/roles ping; a stray `@everyone` typed in the body stays
  inert unless `mentionEveryone` is set on purpose.
- **One-off scheduling.** Scheduled announcements persist in the `scheduled_announcements`
  table; a bot tick (~30s) posts due rows through the *same* `send()`. Times are entered in
  **IST**. **Skip-missed policy:** anything that came due while the bot was offline is marked
  `missed` at startup and never posted late.

## Considered options

- **Prepend-only mentions** (the first cut): rejected — mentions could only sit at the top of
  the message. Replaced by the inline `@`-composer + content-derived `allowed_mentions`.
- **Blanket `parse: ['users','roles']`:** rejected in favour of an explicit allow-list built
  from the content, so an accidental/pasted mention can't ping unintended people.
- **Recurring schedules + catch-up on downtime:** deferred — one-off + skip-missed chosen for
  simplicity and to avoid surprise late blasts (see session 02).

## Consequences

- Two front doors (slash + dashboard), one `core` send → identical composition and gating.
- Scheduling requires the `scheduled_announcements` table + the bot scheduler tick (+ a
  startup sweep). No external queue/cron — the always-on bot process runs the tick.
- **Slash inline mentions are limited by Discord modals** (plain text), so inline placement is
  a dashboard feature; the slash flow uses select menus (mentions prepended). Both share the
  same `send()`.
- `allowed_mentions` is content-derived — any mention markup in the body will ping, by design.
- Scheduled rows store the fully-composed message (with inline markup), so delivery via the
  tick is byte-identical to an immediate send.
