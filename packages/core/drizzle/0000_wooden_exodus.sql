CREATE TABLE IF NOT EXISTS "admins" (
	"guild_id" text NOT NULL,
	"user_id" text NOT NULL,
	CONSTRAINT "admins_guild_id_user_id_pk" PRIMARY KEY("guild_id","user_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "badges" (
	"id" serial PRIMARY KEY NOT NULL,
	"guild_id" text NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"emoji" text DEFAULT '🏅' NOT NULL,
	"criteria" text NOT NULL,
	"threshold" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "channel_rules" (
	"id" serial PRIMARY KEY NOT NULL,
	"guild_id" text NOT NULL,
	"channel_id" text NOT NULL,
	"kind" text NOT NULL,
	"multiplier" real DEFAULT 1 NOT NULL,
	"no_xp" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "event_attendance" (
	"guild_id" text NOT NULL,
	"user_id" text NOT NULL,
	"event_id" integer NOT NULL,
	"day" text NOT NULL,
	CONSTRAINT "event_attendance_guild_id_user_id_event_id_day_pk" PRIMARY KEY("guild_id","user_id","event_id","day")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "event_voice_stats" (
	"guild_id" text NOT NULL,
	"user_id" text NOT NULL,
	"event_id" integer NOT NULL,
	"day" text NOT NULL,
	"username" text DEFAULT '' NOT NULL,
	"channel_id" text DEFAULT '' NOT NULL,
	"present_seconds" integer DEFAULT 0 NOT NULL,
	"muted_seconds" integer DEFAULT 0 NOT NULL,
	"speaking_seconds" integer DEFAULT 0 NOT NULL,
	"first_seen_at" bigint DEFAULT extract(epoch from now())::bigint NOT NULL,
	"last_seen_at" bigint DEFAULT extract(epoch from now())::bigint NOT NULL,
	CONSTRAINT "event_voice_stats_guild_id_user_id_event_id_day_pk" PRIMARY KEY("guild_id","user_id","event_id","day")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "guild_config" (
	"guild_id" text PRIMARY KEY NOT NULL,
	"message_xp" integer DEFAULT 3 NOT NULL,
	"message_cooldown_sec" integer DEFAULT 60 NOT NULL,
	"voice_presence_xp_per_min" integer DEFAULT 2 NOT NULL,
	"voice_speaking_xp_per_min" integer DEFAULT 5 NOT NULL,
	"ignore_muted_voice" boolean DEFAULT true NOT NULL,
	"level_up_channel_id" text,
	"level_up_message" text DEFAULT '🎉 {user} reached level **{level}**!' NOT NULL,
	"tier_up_message" text DEFAULT '🎖️ {user} is now **{role}**!' NOT NULL,
	"voice_capture_channel_id" text,
	"updated_at" bigint DEFAULT extract(epoch from now())::bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "level_rewards" (
	"id" serial PRIMARY KEY NOT NULL,
	"guild_id" text NOT NULL,
	"level" integer NOT NULL,
	"role_id" text NOT NULL,
	"message" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "member_badges" (
	"guild_id" text NOT NULL,
	"user_id" text NOT NULL,
	"badge_key" text NOT NULL,
	"awarded_at" bigint DEFAULT extract(epoch from now())::bigint NOT NULL,
	CONSTRAINT "member_badges_guild_id_user_id_badge_key_pk" PRIMARY KEY("guild_id","user_id","badge_key")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "members" (
	"guild_id" text NOT NULL,
	"user_id" text NOT NULL,
	"username" text DEFAULT '' NOT NULL,
	"xp" integer DEFAULT 0 NOT NULL,
	"level" integer DEFAULT 0 NOT NULL,
	"message_count" integer DEFAULT 0 NOT NULL,
	"voice_seconds" integer DEFAULT 0 NOT NULL,
	"speaking_seconds" integer DEFAULT 0 NOT NULL,
	"last_message_at" bigint,
	"created_at" bigint DEFAULT extract(epoch from now())::bigint NOT NULL,
	"updated_at" bigint DEFAULT extract(epoch from now())::bigint NOT NULL,
	CONSTRAINT "members_guild_id_user_id_pk" PRIMARY KEY("guild_id","user_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "multiplier_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"guild_id" text NOT NULL,
	"name" text NOT NULL,
	"multiplier" real DEFAULT 2 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"counts_attendance" boolean DEFAULT false NOT NULL,
	"day_of_week" integer,
	"start_minute" integer,
	"end_minute" integer,
	"starts_at" bigint,
	"ends_at" bigint,
	"channel_id" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "scheduled_announcements" (
	"id" serial PRIMARY KEY NOT NULL,
	"guild_id" text NOT NULL,
	"channel_id" text NOT NULL,
	"message" text NOT NULL,
	"member_ids" text DEFAULT '[]' NOT NULL,
	"role_ids" text DEFAULT '[]' NOT NULL,
	"mention_everyone" boolean DEFAULT false NOT NULL,
	"fire_at" bigint NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_by" text DEFAULT '' NOT NULL,
	"created_at" bigint DEFAULT extract(epoch from now())::bigint NOT NULL,
	"sent_at" bigint
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ticket_attachments" (
	"id" serial PRIMARY KEY NOT NULL,
	"ticket_id" integer NOT NULL,
	"guild_id" text NOT NULL,
	"filename" text DEFAULT 'image' NOT NULL,
	"content_type" text DEFAULT 'application/octet-stream' NOT NULL,
	"size_bytes" integer DEFAULT 0 NOT NULL,
	"cloudinary_public_id" text DEFAULT '' NOT NULL,
	"url" text DEFAULT '' NOT NULL,
	"created_at" bigint DEFAULT extract(epoch from now())::bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ticket_config" (
	"guild_id" text PRIMARY KEY NOT NULL,
	"panel_channel_id" text,
	"ticket_channel_id" text,
	"staff_role_id" text,
	"panel_message_id" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"updated_at" bigint DEFAULT extract(epoch from now())::bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ticket_participants" (
	"guild_id" text NOT NULL,
	"ticket_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"role" text DEFAULT 'owner' NOT NULL,
	"created_at" bigint DEFAULT extract(epoch from now())::bigint NOT NULL,
	CONSTRAINT "ticket_participants_ticket_id_user_id_pk" PRIMARY KEY("ticket_id","user_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tickets" (
	"id" serial PRIMARY KEY NOT NULL,
	"guild_id" text NOT NULL,
	"user_id" text NOT NULL,
	"username" text DEFAULT '' NOT NULL,
	"subject" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"thread_id" text,
	"status" text DEFAULT 'open' NOT NULL,
	"created_at" bigint DEFAULT extract(epoch from now())::bigint NOT NULL,
	"resolved_at" bigint
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "transcript_jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"guild_id" text NOT NULL,
	"channel_id" text NOT NULL,
	"session_id" text NOT NULL,
	"user_id" text NOT NULL,
	"username" text DEFAULT '' NOT NULL,
	"file_path" text NOT NULL,
	"started_at" bigint NOT NULL,
	"duration_ms" integer DEFAULT 0 NOT NULL,
	"sample_rate" integer DEFAULT 48000 NOT NULL,
	"channels" integer DEFAULT 2 NOT NULL,
	"encoding" text DEFAULT 'pcm_s16le' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"text" text,
	"language" text,
	"error" text,
	"created_at" bigint DEFAULT extract(epoch from now())::bigint NOT NULL,
	"updated_at" bigint DEFAULT extract(epoch from now())::bigint NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "badges_guild_key" ON "badges" USING btree ("guild_id","key");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "channel_rules_guild_channel" ON "channel_rules" USING btree ("guild_id","channel_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "event_voice_stats_event" ON "event_voice_stats" USING btree ("guild_id","event_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "level_rewards_guild_level" ON "level_rewards" USING btree ("guild_id","level");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "scheduled_announcements_due" ON "scheduled_announcements" USING btree ("status","fire_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ticket_attachments_ticket" ON "ticket_attachments" USING btree ("ticket_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tickets_guild_status" ON "tickets" USING btree ("guild_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transcript_jobs_status" ON "transcript_jobs" USING btree ("status","started_at");