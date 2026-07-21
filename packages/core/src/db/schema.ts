import { sql } from 'drizzle-orm'
import {
  bigint,
  boolean,
  index,
  integer,
  pgTable,
  primaryKey,
  real,
  serial,
  text,
  uniqueIndex,
} from 'drizzle-orm/pg-core'

// Epoch-second default (Postgres has no unixepoch()); keeps the same integer-seconds semantics
// as the old sqlite `(unixepoch())` so nowSec() and every comparison keep working unchanged.
const now = sql`extract(epoch from now())::bigint`

// Epoch-second timestamp column: stored as bigint (mode:'number') so JS keeps using plain
// numbers exactly as before. (Optional later: migrate these to timestamptz in a follow-up ADR.)
const epoch = (name: string) => bigint(name, { mode: 'number' })

/** Per-guild member progress — the persistent XP state (survives restarts). */
export const members = pgTable(
  'members',
  {
    guildId: text('guild_id').notNull(),
    userId: text('user_id').notNull(),
    username: text('username').notNull().default(''),
    xp: integer('xp').notNull().default(0),
    level: integer('level').notNull().default(0),
    messageCount: integer('message_count').notNull().default(0),
    voiceSeconds: integer('voice_seconds').notNull().default(0),
    speakingSeconds: integer('speaking_seconds').notNull().default(0),
    lastMessageAt: epoch('last_message_at'), // epoch seconds
    createdAt: epoch('created_at').notNull().default(now),
    updatedAt: epoch('updated_at').notNull().default(now),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.guildId, t.userId] }),
    // Leaderboard (WHERE guild_id = ? ORDER BY xp DESC LIMIT n) and rank() (WHERE guild_id = ?
    // AND xp > ?) sort/scan by xp within a guild; the PK's (guild_id, user_id) prefix can't serve
    // that ordering, so without this they fall back to a sort. Keeps both index-only as the table grows.
    guildXpIdx: index('members_guild_xp').on(t.guildId, t.xp.desc()),
  }),
)

/** One config row per guild — the global knobs. */
export const guildConfig = pgTable('guild_config', {
  guildId: text('guild_id').primaryKey(),
  messageXp: integer('message_xp').notNull().default(3),
  messageCooldownSec: integer('message_cooldown_sec').notNull().default(60),
  voicePresenceXpPerMin: integer('voice_presence_xp_per_min').notNull().default(2),
  voiceSpeakingXpPerMin: integer('voice_speaking_xp_per_min').notNull().default(5),
  ignoreMutedVoice: boolean('ignore_muted_voice').notNull().default(true),
  levelUpChannelId: text('level_up_channel_id'),
  levelUpMessage: text('level_up_message')
    .notNull()
    .default('🎉 {user} reached level **{level}**!'),
  // Global fallback announcement when a member reaches a level-reward tier.
  // Supports {user}, {role}, {level}. A per-tier message on level_rewards overrides it.
  tierUpMessage: text('tier_up_message').notNull().default('🎖️ {user} is now **{role}**!'),
  // Manual voice-capture override: when set, the bot joins this voice channel and tracks
  // activity regardless of events (dashboard "Voice capture" control). Null = off.
  voiceCaptureChannelId: text('voice_capture_channel_id'),
  updatedAt: epoch('updated_at').notNull().default(now),
})

/** Per-channel overrides: multiplier or "no XP here". */
export const channelRules = pgTable(
  'channel_rules',
  {
    id: serial('id').primaryKey(),
    guildId: text('guild_id').notNull(),
    channelId: text('channel_id').notNull(),
    kind: text('kind', { enum: ['text', 'voice'] }).notNull(),
    multiplier: real('multiplier').notNull().default(1),
    noXp: boolean('no_xp').notNull().default(false),
  },
  (t) => ({ uq: uniqueIndex('channel_rules_guild_channel').on(t.guildId, t.channelId) }),
)

/**
 * XP multiplier events. Two shapes:
 *  - recurring weekly window: dayOfWeek (0=Sun..6=Sat, Friday=5) + start/endMinute (mins from UTC midnight)
 *  - one-off window: startsAt/endsAt (epoch seconds)
 * Scope: whole guild, or a single channel when channelId is set.
 */
export const multiplierEvents = pgTable('multiplier_events', {
  id: serial('id').primaryKey(),
  guildId: text('guild_id').notNull(),
  name: text('name').notNull(),
  multiplier: real('multiplier').notNull().default(2),
  enabled: boolean('enabled').notNull().default(true),
  countsAttendance: boolean('counts_attendance').notNull().default(false),
  dayOfWeek: integer('day_of_week'),
  startMinute: integer('start_minute'),
  endMinute: integer('end_minute'),
  startsAt: epoch('starts_at'),
  endsAt: epoch('ends_at'),
  channelId: text('channel_id'),
})

/**
 * Optional per-event XP booster scope. No rows for an event means the multiplier applies
 * to everyone; one or more rows means only those user IDs receive the multiplier.
 */
export const eventTargetMembers = pgTable(
  'event_target_members',
  {
    guildId: text('guild_id').notNull(),
    eventId: integer('event_id').notNull(),
    userId: text('user_id').notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.guildId, t.eventId, t.userId] }),
    eventIdx: index('event_target_members_event').on(t.guildId, t.eventId),
  }),
)

/** level → role to grant on reaching it. */
export const levelRewards = pgTable(
  'level_rewards',
  {
    id: serial('id').primaryKey(),
    guildId: text('guild_id').notNull(),
    level: integer('level').notNull(),
    roleId: text('role_id').notNull(),
    // Optional per-tier announcement text; falls back to guildConfig.tierUpMessage.
    message: text('message'),
  },
  (t) => ({ uq: uniqueIndex('level_rewards_guild_level').on(t.guildId, t.level) }),
)

/** Badge definitions — earned when a stat crosses `threshold`. */
export const badges = pgTable(
  'badges',
  {
    id: serial('id').primaryKey(),
    guildId: text('guild_id').notNull(),
    key: text('key').notNull(),
    name: text('name').notNull(),
    description: text('description').notNull().default(''),
    emoji: text('emoji').notNull().default('🏅'),
    criteria: text('criteria', {
      enum: ['level', 'messages', 'voice_minutes', 'speaking_minutes', 'fridays_attended'],
    }).notNull(),
    threshold: integer('threshold').notNull(),
  },
  (t) => ({ uq: uniqueIndex('badges_guild_key').on(t.guildId, t.key) }),
)

export const memberBadges = pgTable(
  'member_badges',
  {
    guildId: text('guild_id').notNull(),
    userId: text('user_id').notNull(),
    badgeKey: text('badge_key').notNull(),
    awardedAt: epoch('awarded_at').notNull().default(now),
  },
  (t) => ({ pk: primaryKey({ columns: [t.guildId, t.userId, t.badgeKey] }) }),
)

/** One row per (member, event, day) — powers the "attended N Fridays" badge. */
export const eventAttendance = pgTable(
  'event_attendance',
  {
    guildId: text('guild_id').notNull(),
    userId: text('user_id').notNull(),
    eventId: integer('event_id').notNull(),
    day: text('day').notNull(), // yyyy-mm-dd (IST) — matches the IST event windows
  },
  (t) => ({ pk: primaryKey({ columns: [t.guildId, t.userId, t.eventId, t.day] }) }),
)

/**
 * Per (member, event, day) voice-duration accumulator — the data behind the attendance
 * dashboard. Complements `event_attendance` (a binary "showed up" flag) by recording HOW
 * LONG each person stayed, split by mute state and speaking.
 *
 * One row per event-day: a disconnect + rejoin during the same event/day accumulates into
 * the SAME row (counters are incremented each XP tick). Time spent disconnected is never
 * billed — the tracker drops the in-memory session on leave and resets the clock on rejoin.
 *
 * Derived views: unmuted = presentSeconds − mutedSeconds; talk-time = speakingSeconds.
 */
export const eventVoiceStats = pgTable(
  'event_voice_stats',
  {
    guildId: text('guild_id').notNull(),
    userId: text('user_id').notNull(),
    eventId: integer('event_id').notNull(),
    day: text('day').notNull(), // yyyy-mm-dd (IST) — matches event_attendance & the IST event windows
    username: text('username').notNull().default(''),
    channelId: text('channel_id').notNull().default(''),
    // Total seconds connected to the VC (muted + unmuted) — "how long they stayed".
    presentSeconds: integer('present_seconds').notNull().default(0),
    // Of the above, seconds spent muted/deafened.
    mutedSeconds: integer('muted_seconds').notNull().default(0),
    // Seconds in ticks where the receiver reported them transmitting audio.
    speakingSeconds: integer('speaking_seconds').notNull().default(0),
    firstSeenAt: epoch('first_seen_at').notNull().default(now), // epoch seconds
    lastSeenAt: epoch('last_seen_at').notNull().default(now),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.guildId, t.userId, t.eventId, t.day] }),
    eventIdx: index('event_voice_stats_event').on(t.guildId, t.eventId),
  }),
)

/** Dashboard admin allowlist (in addition to Discord MANAGE_GUILD perm). */
export const admins = pgTable(
  'admins',
  {
    guildId: text('guild_id').notNull(),
    userId: text('user_id').notNull(),
  },
  (t) => ({ pk: primaryKey({ columns: [t.guildId, t.userId] }) }),
)

/**
 * Scheduled (one-off) announcements. The bot's scheduler tick claims `pending` rows
 * whose `fireAt` has arrived and posts them via the shared announcements service.
 * `fireAt` is epoch seconds (computed from an IST wall-clock at creation). Member/role
 * mention lists are stored as JSON text — the same payload the immediate-send path uses.
 */
export const scheduledAnnouncements = pgTable(
  'scheduled_announcements',
  {
    id: serial('id').primaryKey(),
    guildId: text('guild_id').notNull(),
    channelId: text('channel_id').notNull(),
    message: text('message').notNull(),
    // JSON-encoded string[] of user / role ids to mention.
    memberIds: text('member_ids').notNull().default('[]'),
    roleIds: text('role_ids').notNull().default('[]'),
    mentionEveryone: boolean('mention_everyone').notNull().default(false),
    fireAt: epoch('fire_at').notNull(), // epoch seconds
    status: text('status', { enum: ['pending', 'sent', 'missed', 'cancelled'] })
      .notNull()
      .default('pending'),
    createdBy: text('created_by').notNull().default(''),
    createdAt: epoch('created_at').notNull().default(now),
    sentAt: epoch('sent_at'),
  },
  // Scheduler polls pending rows by fire time; index keeps that cheap.
  (t) => ({ dueIdx: index('scheduled_announcements_due').on(t.status, t.fireAt) }),
)

/**
 * Transcription work queue. One row per captured utterance (Part 1 of the transcript
 * pipeline): the bot decodes a speaker's audio to a WAV on the shared audio volume and
 * inserts a `pending` row here. A separate Whisper worker (Part 2) claims pending rows,
 * transcribes the file, and writes back `text`/`language` — the two halves never share
 * state beyond this table + the audio file, so the worker can run anywhere.
 */
export const transcriptJobs = pgTable(
  'transcript_jobs',
  {
    id: text('id').primaryKey(), // uuid, minted by the capturer
    guildId: text('guild_id').notNull(),
    channelId: text('channel_id').notNull(),
    // One capture window (a single event/manual-capture join). Groups utterances so a
    // full conversation can be reassembled in order across speakers.
    sessionId: text('session_id').notNull(),
    userId: text('user_id').notNull(),
    username: text('username').notNull().default(''),
    filePath: text('file_path').notNull(),
    startedAt: epoch('started_at').notNull(), // epoch seconds
    durationMs: integer('duration_ms').notNull().default(0),
    // Format of the stored WAV — self-describing so the worker needn't guess.
    sampleRate: integer('sample_rate').notNull().default(48000),
    channels: integer('channels').notNull().default(2),
    encoding: text('encoding').notNull().default('pcm_s16le'),
    status: text('status', { enum: ['pending', 'processing', 'done', 'error'] })
      .notNull()
      .default('pending'),
    text: text('text'),
    language: text('language'),
    error: text('error'),
    createdAt: epoch('created_at').notNull().default(now),
    updatedAt: epoch('updated_at').notNull().default(now),
  },
  // Worker polls by status; index keeps that cheap as the table grows.
  (t) => ({ statusIdx: index('transcript_jobs_status').on(t.status, t.startedAt) }),
)

/**
 * Per-guild ticket system config. `panelChannelId` is the PUBLIC channel that hosts the
 * "Raise a ticket" button (users must see it). `ticketChannelId` is the HIDDEN channel
 * where private ticket threads live — @everyone can't view it, so mentioning an outsider
 * in a thread there does nothing (Discord gates thread visibility on channel access). The
 * bot grants each submitter a personal View-Channel overwrite so they can reach their own
 * thread. `panelMessageId` lets `/ticket-setup` re-post/replace a stale panel.
 */
export const ticketConfig = pgTable('ticket_config', {
  guildId: text('guild_id').primaryKey(),
  panelChannelId: text('panel_channel_id'),
  ticketChannelId: text('ticket_channel_id'),
  // Role that can see all tickets + pull a third person into a thread. Setup grants it
  // View Channel + Manage Threads on the ticket channel.
  staffRoleId: text('staff_role_id'),
  panelMessageId: text('panel_message_id'),
  enabled: boolean('enabled').notNull().default(true),
  updatedAt: epoch('updated_at').notNull().default(now),
})

/**
 * One row per raised ticket. Metadata only — image references live in `ticket_attachments`
 * so listing/queries stay light. `threadId` is the private thread created at submit time;
 * the ticket content + conversation all live inside it.
 */
export const tickets = pgTable(
  'tickets',
  {
    id: serial('id').primaryKey(),
    guildId: text('guild_id').notNull(),
    userId: text('user_id').notNull(),
    username: text('username').notNull().default(''),
    subject: text('subject').notNull(),
    description: text('description').notNull().default(''),
    threadId: text('thread_id'),
    status: text('status', { enum: ['open', 'resolved', 'closed'] })
      .notNull()
      .default('open'),
    createdAt: epoch('created_at').notNull().default(now),
    resolvedAt: epoch('resolved_at'),
  },
  // Staff triage lists by (guild, status); index keeps that cheap.
  (t) => ({ statusIdx: index('tickets_guild_status').on(t.guildId, t.status) }),
)

/**
 * Who has been granted access to a ticket's private thread: the submitter (`owner`) plus
 * anyone staff pulled in (`staff`). Each row corresponds to a per-user View-Channel
 * overwrite on the hidden ticket channel. On close we revoke an overwrite only if that
 * user isn't still a participant of another open ticket (overwrites are channel-wide).
 */
export const ticketParticipants = pgTable(
  'ticket_participants',
  {
    guildId: text('guild_id').notNull(),
    ticketId: integer('ticket_id').notNull(),
    userId: text('user_id').notNull(),
    role: text('role', { enum: ['owner', 'staff'] })
      .notNull()
      .default('owner'),
    createdAt: epoch('created_at').notNull().default(now),
  },
  (t) => ({ pk: primaryKey({ columns: [t.ticketId, t.userId] }) }),
)

/**
 * Image reference for a ticket, one row per attachment. The raw bytes live in Cloudinary
 * (off-DB object storage, §2.2) — the bot uploads each modal upload server-side and stores
 * only the Cloudinary `public_id` + delivery `url` here (plus lightweight metadata), so the
 * heavy binary never enters Postgres and never bloats a `pg_dump`. Kept in its own table so
 * the reference is never dragged into ticket-list queries.
 */
export const ticketAttachments = pgTable(
  'ticket_attachments',
  {
    id: serial('id').primaryKey(),
    ticketId: integer('ticket_id').notNull(),
    guildId: text('guild_id').notNull(),
    filename: text('filename').notNull().default('image'),
    contentType: text('content_type').notNull().default('application/octet-stream'),
    sizeBytes: integer('size_bytes').notNull().default(0),
    // Cloudinary reference (replaces the old `data` blob). Empty until an upload lands.
    cloudinaryPublicId: text('cloudinary_public_id').notNull().default(''),
    url: text('url').notNull().default(''),
    createdAt: epoch('created_at').notNull().default(now),
  },
  (t) => ({ ticketIdx: index('ticket_attachments_ticket').on(t.ticketId) }),
)
