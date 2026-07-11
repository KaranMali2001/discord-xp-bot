import { sql } from 'drizzle-orm'
import { integer, primaryKey, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

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
