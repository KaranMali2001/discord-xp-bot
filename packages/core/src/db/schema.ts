import { sql } from 'drizzle-orm'
import {
  blob,
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core'

const now = sql`(unixepoch())`

/** Per-guild member progress — the persistent XP state (survives restarts). */
export const members = sqliteTable(
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
    lastMessageAt: integer('last_message_at'), // epoch seconds
    createdAt: integer('created_at').notNull().default(now),
    updatedAt: integer('updated_at').notNull().default(now),
  },
  (t) => ({ pk: primaryKey({ columns: [t.guildId, t.userId] }) }),
)

/** One config row per guild — the global knobs. */
export const guildConfig = sqliteTable('guild_config', {
  guildId: text('guild_id').primaryKey(),
  messageXp: integer('message_xp').notNull().default(3),
  messageCooldownSec: integer('message_cooldown_sec').notNull().default(60),
  voicePresenceXpPerMin: integer('voice_presence_xp_per_min').notNull().default(2),
  voiceSpeakingXpPerMin: integer('voice_speaking_xp_per_min').notNull().default(5),
  ignoreMutedVoice: integer('ignore_muted_voice', { mode: 'boolean' }).notNull().default(true),
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
  updatedAt: integer('updated_at').notNull().default(now),
})

/** Per-channel overrides: multiplier or "no XP here". */
export const channelRules = sqliteTable(
  'channel_rules',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    guildId: text('guild_id').notNull(),
    channelId: text('channel_id').notNull(),
    kind: text('kind', { enum: ['text', 'voice'] }).notNull(),
    multiplier: real('multiplier').notNull().default(1),
    noXp: integer('no_xp', { mode: 'boolean' }).notNull().default(false),
  },
  (t) => ({ uq: uniqueIndex('channel_rules_guild_channel').on(t.guildId, t.channelId) }),
)

/**
 * XP multiplier events. Two shapes:
 *  - recurring weekly window: dayOfWeek (0=Sun..6=Sat, Friday=5) + start/endMinute (mins from UTC midnight)
 *  - one-off window: startsAt/endsAt (epoch seconds)
 * Scope: whole guild, or a single channel when channelId is set.
 */
export const multiplierEvents = sqliteTable('multiplier_events', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  guildId: text('guild_id').notNull(),
  name: text('name').notNull(),
  multiplier: real('multiplier').notNull().default(2),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  countsAttendance: integer('counts_attendance', { mode: 'boolean' }).notNull().default(false),
  dayOfWeek: integer('day_of_week'),
  startMinute: integer('start_minute'),
  endMinute: integer('end_minute'),
  startsAt: integer('starts_at'),
  endsAt: integer('ends_at'),
  channelId: text('channel_id'),
})

/** level → role to grant on reaching it. */
export const levelRewards = sqliteTable(
  'level_rewards',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    guildId: text('guild_id').notNull(),
    level: integer('level').notNull(),
    roleId: text('role_id').notNull(),
    // Optional per-tier announcement text; falls back to guildConfig.tierUpMessage.
    message: text('message'),
  },
  (t) => ({ uq: uniqueIndex('level_rewards_guild_level').on(t.guildId, t.level) }),
)

/** Badge definitions — earned when a stat crosses `threshold`. */
export const badges = sqliteTable(
  'badges',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
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

export const memberBadges = sqliteTable(
  'member_badges',
  {
    guildId: text('guild_id').notNull(),
    userId: text('user_id').notNull(),
    badgeKey: text('badge_key').notNull(),
    awardedAt: integer('awarded_at').notNull().default(now),
  },
  (t) => ({ pk: primaryKey({ columns: [t.guildId, t.userId, t.badgeKey] }) }),
)

/** One row per (member, event, day) — powers the "attended N Fridays" badge. */
export const eventAttendance = sqliteTable(
  'event_attendance',
  {
    guildId: text('guild_id').notNull(),
    userId: text('user_id').notNull(),
    eventId: integer('event_id').notNull(),
    day: text('day').notNull(), // yyyy-mm-dd (UTC)
  },
  (t) => ({ pk: primaryKey({ columns: [t.guildId, t.userId, t.eventId, t.day] }) }),
)

/** Dashboard admin allowlist (in addition to Discord MANAGE_GUILD perm). */
export const admins = sqliteTable(
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
export const scheduledAnnouncements = sqliteTable(
  'scheduled_announcements',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    guildId: text('guild_id').notNull(),
    channelId: text('channel_id').notNull(),
    message: text('message').notNull(),
    // JSON-encoded string[] of user / role ids to mention.
    memberIds: text('member_ids').notNull().default('[]'),
    roleIds: text('role_ids').notNull().default('[]'),
    mentionEveryone: integer('mention_everyone', { mode: 'boolean' }).notNull().default(false),
    fireAt: integer('fire_at').notNull(), // epoch seconds
    status: text('status', { enum: ['pending', 'sent', 'missed', 'cancelled'] })
      .notNull()
      .default('pending'),
    createdBy: text('created_by').notNull().default(''),
    createdAt: integer('created_at').notNull().default(now),
    sentAt: integer('sent_at'),
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
export const transcriptJobs = sqliteTable(
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
    startedAt: integer('started_at').notNull(), // epoch seconds
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
    createdAt: integer('created_at').notNull().default(now),
    updatedAt: integer('updated_at').notNull().default(now),
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
export const ticketConfig = sqliteTable('ticket_config', {
  guildId: text('guild_id').primaryKey(),
  panelChannelId: text('panel_channel_id'),
  ticketChannelId: text('ticket_channel_id'),
  // Role that can see all tickets + pull a third person into a thread. Setup grants it
  // View Channel + Manage Threads on the ticket channel.
  staffRoleId: text('staff_role_id'),
  // Deprecated: superseded by ticketChannelId. Kept nullable/unused to keep the migration
  // additive (drizzle would otherwise prompt to disambiguate a rename). Drop on Neon move.
  modChannelId: text('mod_channel_id'),
  panelMessageId: text('panel_message_id'),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  updatedAt: integer('updated_at').notNull().default(now),
})

/**
 * One row per raised ticket. Metadata only — image bytes live in `ticket_attachments` so
 * listing/queries stay light. `threadId` is the private thread created at submit time; the
 * ticket content + conversation all live inside it.
 */
export const tickets = sqliteTable(
  'tickets',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    guildId: text('guild_id').notNull(),
    userId: text('user_id').notNull(),
    username: text('username').notNull().default(''),
    subject: text('subject').notNull(),
    description: text('description').notNull().default(''),
    threadId: text('thread_id'),
    // Deprecated (no separate mod-channel post anymore). Kept to keep the migration
    // additive; drop on the Neon move.
    modMessageId: text('mod_message_id'),
    status: text('status', { enum: ['open', 'resolved', 'closed'] })
      .notNull()
      .default('open'),
    createdAt: integer('created_at').notNull().default(now),
    resolvedAt: integer('resolved_at'),
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
export const ticketParticipants = sqliteTable(
  'ticket_participants',
  {
    guildId: text('guild_id').notNull(),
    ticketId: integer('ticket_id').notNull(),
    userId: text('user_id').notNull(),
    role: text('role', { enum: ['owner', 'staff'] })
      .notNull()
      .default('owner'),
    createdAt: integer('created_at').notNull().default(now),
  },
  (t) => ({ pk: primaryKey({ columns: [t.ticketId, t.userId] }) }),
)

/**
 * Raw image bytes for a ticket, one row per attachment. Stored as a BLOB (source of truth)
 * — the bot downloads each modal upload from Discord's CDN and persists it here so the
 * image survives the staff message being deleted. Kept in its own table so the heavy
 * binary is never dragged into ticket-list queries.
 */
export const ticketAttachments = sqliteTable(
  'ticket_attachments',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    ticketId: integer('ticket_id').notNull(),
    guildId: text('guild_id').notNull(),
    filename: text('filename').notNull().default('image'),
    contentType: text('content_type').notNull().default('application/octet-stream'),
    sizeBytes: integer('size_bytes').notNull().default(0),
    data: blob('data', { mode: 'buffer' }).notNull(),
    createdAt: integer('created_at').notNull().default(now),
  },
  (t) => ({ ticketIdx: index('ticket_attachments_ticket').on(t.ticketId) }),
)
