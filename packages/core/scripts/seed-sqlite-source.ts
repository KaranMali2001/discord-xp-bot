/**
 * LOCAL-ONLY: build a sqlite "source" database that stands in for a Turso export, so the
 * data-migration pipeline can be proved end-to-end without ever touching production.
 *
 * It recreates the OLD (pre-migration) sqlite schema — including the columns the Postgres
 * move drops (`ticket_config.mod_channel_id`, `tickets.mod_message_id`) and the raw image
 * `ticket_attachments.data` BLOB — and seeds representative rows across all 16 tables that
 * exercise every tricky case: 0/1 booleans, autoincrement + composite + text PKs, epoch-second
 * integers, a real() multiplier, and a blob. `migrate-to-postgres.ts` reads from this file.
 *
 * Usage: tsx scripts/seed-sqlite-source.ts [path]   (default ./migration-source.sqlite)
 */
import Database from 'better-sqlite3'

const path = process.argv[2] ?? './migration-source.sqlite'
const db = new Database(path)
db.pragma('journal_mode = WAL')

// ── old sqlite schema (verbatim shape of the pre-migration DB) ──────────────
db.exec(`
DROP TABLE IF EXISTS members;
DROP TABLE IF EXISTS guild_config;
DROP TABLE IF EXISTS channel_rules;
DROP TABLE IF EXISTS multiplier_events;
DROP TABLE IF EXISTS level_rewards;
DROP TABLE IF EXISTS badges;
DROP TABLE IF EXISTS member_badges;
DROP TABLE IF EXISTS event_attendance;
DROP TABLE IF EXISTS event_voice_stats;
DROP TABLE IF EXISTS admins;
DROP TABLE IF EXISTS scheduled_announcements;
DROP TABLE IF EXISTS transcript_jobs;
DROP TABLE IF EXISTS ticket_config;
DROP TABLE IF EXISTS tickets;
DROP TABLE IF EXISTS ticket_participants;
DROP TABLE IF EXISTS ticket_attachments;

CREATE TABLE members (
  guild_id TEXT NOT NULL, user_id TEXT NOT NULL, username TEXT NOT NULL DEFAULT '',
  xp INTEGER NOT NULL DEFAULT 0, level INTEGER NOT NULL DEFAULT 0,
  message_count INTEGER NOT NULL DEFAULT 0, voice_seconds INTEGER NOT NULL DEFAULT 0,
  speaking_seconds INTEGER NOT NULL DEFAULT 0, last_message_at INTEGER,
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
  PRIMARY KEY (guild_id, user_id));

CREATE TABLE guild_config (
  guild_id TEXT PRIMARY KEY, message_xp INTEGER NOT NULL DEFAULT 3,
  message_cooldown_sec INTEGER NOT NULL DEFAULT 60, voice_presence_xp_per_min INTEGER NOT NULL DEFAULT 2,
  voice_speaking_xp_per_min INTEGER NOT NULL DEFAULT 5, ignore_muted_voice INTEGER NOT NULL DEFAULT 1,
  level_up_channel_id TEXT, level_up_message TEXT NOT NULL DEFAULT '',
  tier_up_message TEXT NOT NULL DEFAULT '', voice_capture_channel_id TEXT, updated_at INTEGER NOT NULL);

CREATE TABLE channel_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT, guild_id TEXT NOT NULL, channel_id TEXT NOT NULL,
  kind TEXT NOT NULL, multiplier REAL NOT NULL DEFAULT 1, no_xp INTEGER NOT NULL DEFAULT 0);

CREATE TABLE multiplier_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT, guild_id TEXT NOT NULL, name TEXT NOT NULL,
  multiplier REAL NOT NULL DEFAULT 2, enabled INTEGER NOT NULL DEFAULT 1, counts_attendance INTEGER NOT NULL DEFAULT 0,
  day_of_week INTEGER, start_minute INTEGER, end_minute INTEGER, starts_at INTEGER, ends_at INTEGER, channel_id TEXT);

CREATE TABLE level_rewards (
  id INTEGER PRIMARY KEY AUTOINCREMENT, guild_id TEXT NOT NULL, level INTEGER NOT NULL,
  role_id TEXT NOT NULL, message TEXT);

CREATE TABLE badges (
  id INTEGER PRIMARY KEY AUTOINCREMENT, guild_id TEXT NOT NULL, key TEXT NOT NULL, name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '', emoji TEXT NOT NULL DEFAULT '', criteria TEXT NOT NULL, threshold INTEGER NOT NULL);

CREATE TABLE member_badges (
  guild_id TEXT NOT NULL, user_id TEXT NOT NULL, badge_key TEXT NOT NULL, awarded_at INTEGER NOT NULL,
  PRIMARY KEY (guild_id, user_id, badge_key));

CREATE TABLE event_attendance (
  guild_id TEXT NOT NULL, user_id TEXT NOT NULL, event_id INTEGER NOT NULL, day TEXT NOT NULL,
  PRIMARY KEY (guild_id, user_id, event_id, day));

CREATE TABLE event_voice_stats (
  guild_id TEXT NOT NULL, user_id TEXT NOT NULL, event_id INTEGER NOT NULL, day TEXT NOT NULL,
  username TEXT NOT NULL DEFAULT '', channel_id TEXT NOT NULL DEFAULT '',
  present_seconds INTEGER NOT NULL DEFAULT 0, muted_seconds INTEGER NOT NULL DEFAULT 0,
  speaking_seconds INTEGER NOT NULL DEFAULT 0, first_seen_at INTEGER NOT NULL, last_seen_at INTEGER NOT NULL,
  PRIMARY KEY (guild_id, user_id, event_id, day));

CREATE TABLE admins (guild_id TEXT NOT NULL, user_id TEXT NOT NULL, PRIMARY KEY (guild_id, user_id));

CREATE TABLE scheduled_announcements (
  id INTEGER PRIMARY KEY AUTOINCREMENT, guild_id TEXT NOT NULL, channel_id TEXT NOT NULL, message TEXT NOT NULL,
  member_ids TEXT NOT NULL DEFAULT '[]', role_ids TEXT NOT NULL DEFAULT '[]', mention_everyone INTEGER NOT NULL DEFAULT 0,
  fire_at INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'pending', created_by TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL, sent_at INTEGER);

CREATE TABLE transcript_jobs (
  id TEXT PRIMARY KEY, guild_id TEXT NOT NULL, channel_id TEXT NOT NULL, session_id TEXT NOT NULL,
  user_id TEXT NOT NULL, username TEXT NOT NULL DEFAULT '', file_path TEXT NOT NULL, started_at INTEGER NOT NULL,
  duration_ms INTEGER NOT NULL DEFAULT 0, sample_rate INTEGER NOT NULL DEFAULT 48000, channels INTEGER NOT NULL DEFAULT 2,
  encoding TEXT NOT NULL DEFAULT 'pcm_s16le', status TEXT NOT NULL DEFAULT 'pending', text TEXT, language TEXT, error TEXT,
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);

CREATE TABLE ticket_config (
  guild_id TEXT PRIMARY KEY, panel_channel_id TEXT, ticket_channel_id TEXT, staff_role_id TEXT,
  mod_channel_id TEXT, panel_message_id TEXT, enabled INTEGER NOT NULL DEFAULT 1, updated_at INTEGER NOT NULL);

CREATE TABLE tickets (
  id INTEGER PRIMARY KEY AUTOINCREMENT, guild_id TEXT NOT NULL, user_id TEXT NOT NULL, username TEXT NOT NULL DEFAULT '',
  subject TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', thread_id TEXT, mod_message_id TEXT,
  status TEXT NOT NULL DEFAULT 'open', created_at INTEGER NOT NULL, resolved_at INTEGER);

CREATE TABLE ticket_participants (
  guild_id TEXT NOT NULL, ticket_id INTEGER NOT NULL, user_id TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'owner',
  created_at INTEGER NOT NULL, PRIMARY KEY (ticket_id, user_id));

CREATE TABLE ticket_attachments (
  id INTEGER PRIMARY KEY AUTOINCREMENT, ticket_id INTEGER NOT NULL, guild_id TEXT NOT NULL,
  filename TEXT NOT NULL DEFAULT 'image', content_type TEXT NOT NULL DEFAULT 'application/octet-stream',
  size_bytes INTEGER NOT NULL DEFAULT 0, data BLOB NOT NULL, created_at INTEGER NOT NULL);
`)

const now = Math.floor(Date.now() / 1000)
const G = 'guild_001'

// ── representative seed rows ────────────────────────────────────────────────
db.prepare(
  `INSERT INTO guild_config (guild_id, message_xp, ignore_muted_voice, level_up_message, tier_up_message, updated_at)
   VALUES (?, 5, 0, 'lvl {level}', 'tier {role}', ?)`,
).run(G, now)

const insMember = db.prepare(
  `INSERT INTO members (guild_id, user_id, username, xp, level, message_count, voice_seconds, speaking_seconds, last_message_at, created_at, updated_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
)
insMember.run(G, 'user_a', 'Alice', 1500, 5, 200, 3600, 1200, now, now - 1000, now)
insMember.run(G, 'user_b', 'Bob', 800, 3, 120, 600, 60, now, now - 900, now)
insMember.run(G, 'user_c', 'Carol', 42, 1, 5, 0, 0, null, now - 100, now)

db.prepare('INSERT INTO admins (guild_id, user_id) VALUES (?, ?)').run(G, 'user_a')

db.prepare(
  `INSERT INTO channel_rules (guild_id, channel_id, kind, multiplier, no_xp) VALUES (?, ?, 'text', 2.5, 0)`,
).run(G, 'chan_general')
db.prepare(
  `INSERT INTO channel_rules (guild_id, channel_id, kind, multiplier, no_xp) VALUES (?, ?, 'text', 1, 1)`,
).run(G, 'chan_spam')

db.prepare(
  `INSERT INTO multiplier_events (guild_id, name, multiplier, enabled, counts_attendance, day_of_week, start_minute, end_minute, channel_id)
   VALUES (?, 'Friday Discussion', 3, 1, 1, 5, 1080, 1200, NULL)`,
).run(G)

db.prepare(
  `INSERT INTO level_rewards (guild_id, level, role_id, message) VALUES (?, 5, 'role_veteran', 'welcome {user}')`,
).run(G)

db.prepare(
  `INSERT INTO badges (guild_id, key, name, description, emoji, criteria, threshold)
   VALUES (?, 'chatterbox', 'Chatterbox', '100 messages', '💬', 'messages', 100)`,
).run(G)

db.prepare(
  `INSERT INTO member_badges (guild_id, user_id, badge_key, awarded_at) VALUES (?, 'user_a', 'chatterbox', ?)`,
).run(G, now)

db.prepare(
  `INSERT INTO event_attendance (guild_id, user_id, event_id, day) VALUES (?, 'user_a', 1, '2026-07-17')`,
).run(G)

db.prepare(
  `INSERT INTO event_voice_stats (guild_id, user_id, event_id, day, username, channel_id, present_seconds, muted_seconds, speaking_seconds, first_seen_at, last_seen_at)
   VALUES (?, 'user_a', 1, '2026-07-17', 'Alice', 'vc_1', 3600, 600, 1200, ?, ?)`,
).run(G, now - 3600, now)

db.prepare(
  `INSERT INTO scheduled_announcements (guild_id, channel_id, message, member_ids, role_ids, mention_everyone, fire_at, status, created_by, created_at)
   VALUES (?, 'chan_general', 'Event soon!', '["user_a"]', '["role_veteran"]', 1, ?, 'pending', 'user_a', ?)`,
).run(G, now + 3600, now)

db.prepare(
  `INSERT INTO transcript_jobs (id, guild_id, channel_id, session_id, user_id, username, file_path, started_at, duration_ms, created_at, updated_at)
   VALUES ('job_uuid_1', ?, 'vc_1', 'sess_1', 'user_a', 'Alice', '/data/audio/sess_1/job_uuid_1.wav', ?, 4200, ?, ?)`,
).run(G, now - 60, now, now)

db.prepare(
  `INSERT INTO ticket_config (guild_id, panel_channel_id, ticket_channel_id, staff_role_id, mod_channel_id, panel_message_id, enabled, updated_at)
   VALUES (?, 'chan_panel', 'chan_tickets', 'role_staff', 'chan_OLD_mod', 'msg_panel', 1, ?)`,
).run(G, now)

db.prepare(
  `INSERT INTO tickets (guild_id, user_id, username, subject, description, thread_id, mod_message_id, status, created_at)
   VALUES (?, 'user_b', 'Bob', 'Help please', 'It is broken', 'thread_1', 'msg_OLD_mod', 'open', ?)`,
).run(G, now)

db.prepare(
  `INSERT INTO ticket_participants (guild_id, ticket_id, user_id, role, created_at) VALUES (?, 1, 'user_b', 'owner', ?)`,
).run(G, now)

db.prepare(
  `INSERT INTO ticket_attachments (ticket_id, guild_id, filename, content_type, size_bytes, data, created_at)
   VALUES (1, ?, 'screenshot.png', 'image/png', 1234, ?, ?)`,
).run(G, Buffer.from('fake-png-bytes-for-local-test'), now)

const counts = db
  .prepare(
    `SELECT
      (SELECT count(*) FROM members) m, (SELECT count(*) FROM channel_rules) cr,
      (SELECT count(*) FROM tickets) t, (SELECT count(*) FROM ticket_attachments) ta`,
  )
  .get() as Record<string, number>
console.log('✅ seeded sqlite source at', path)
console.log(
  '   members=%d channel_rules=%d tickets=%d ticket_attachments=%d',
  counts.m,
  counts.cr,
  counts.t,
  counts.ta,
)
db.close()
