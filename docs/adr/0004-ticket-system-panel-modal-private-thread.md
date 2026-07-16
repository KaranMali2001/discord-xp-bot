# Discord ticket system — public panel → modal → private thread

## Status

accepted

## Context & Decision

Guilds need a support-ticket flow. We built one around **private threads off a public panel
channel**, with a staff-only intake channel:

1. A **public, read-only panel channel** shows a "🎫 Raise a ticket" button.
2. A member clicks it → a **modal** collects subject, description, and image attachments.
3. On submit the bot creates a **private thread** (visible only to the raiser + staff), stores
   the ticket, downloads the images and persists them, and posts a **summary to a staff-only
   collection channel** with action buttons (open thread / resolve / close).
4. Staff open the thread, work the ticket, and mark it **resolved** or **closed** (close locks
   and archives the thread). Staff can pull a third person in by `@`-mentioning them; non-staff
   can't.

Like the rest of the app, all Discord mutations go through **`core` over Discord REST** (per
[ADR 0001](0001-level-role-sync-pure-diff-applied-per-transport.md)). Ticketing is a new core
domain (`domains/ticketing/`: `schema` · `dao` · `service` · `setup`). **`applyTicketSetup()`
is the single shared setup path** called by both the `/ticket-setup` slash command **and** the
dashboard `PUT /guilds/:id/tickets` — it applies channel permission overwrites, (re)posts the
panel message, and persists config, so the two entry points can't diverge.

**Data model** (`packages/core/src/db/schema.ts`):
- `ticket_config` — per-guild setup: panel channel, collection channel, staff role, panel
  message id, enabled.
- `tickets` — one row per ticket: raiser, subject/description, `status` (`open` / `resolved` /
  `closed`), `threadId`, timestamps.
- `ticket_participants` — access control per ticket (`owner` / `staff`); used to add/remove
  thread members and to clean up on close.
- `ticket_attachments` — uploaded images stored as **BLOBs**, split into their own table so
  staff triage/list queries never drag the image bytes.

**Staff authorization** is flexible: the configured staff role **OR** Manage Threads **OR**
Manage Guild **OR** the auth admin allowlist.

## Considered options

- **A private channel per ticket:** rejected — Discord caps channels (~500/guild, 50/category)
  and needs manual cleanup. Threads are effectively unlimited, auto-archive, and stay invisible
  to non-members even on a public parent channel.
- **Store images only as Discord CDN links:** rejected — links rot and the staff message can be
  deleted. BLOBs in the DB survive, so staff can always retrieve the evidence.
- **A "claimed" status:** deferred — kept the model simple (`open` → `resolved` → `closed`);
  can add claiming later.
- **Two separate setup implementations (bot vs dashboard):** rejected — one `applyTicketSetup()`
  in core keeps both identical (ADR 0001 pattern).

## Consequences

- The bot needs **Manage Roles / Manage Channels / Create Private Threads**; there's no
  pre-flight check, so setup can fail at apply time if a permission is missing (surfaced as an
  error to the caller).
- Images live as BLOBs in the (Turso) DB — watch row/size growth; the attachments table is kept
  separate from `tickets` so listing stays cheap.
- **Not yet built (Phase 2):** transcript-on-close, and a dashboard ticket **list/triage** view
  (the setup tab only configures the system; the data model already supports listing).
- A couple of superseded columns are retained to keep migrations additive.
