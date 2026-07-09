CREATE TABLE `admins` (
	`guild_id` text NOT NULL,
	`user_id` text NOT NULL,
	PRIMARY KEY(`guild_id`, `user_id`)
);
--> statement-breakpoint
CREATE TABLE `badges` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`guild_id` text NOT NULL,
	`key` text NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`emoji` text DEFAULT '🏅' NOT NULL,
	`criteria` text NOT NULL,
	`threshold` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `badges_guild_key` ON `badges` (`guild_id`,`key`);--> statement-breakpoint
CREATE TABLE `channel_rules` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`guild_id` text NOT NULL,
	`channel_id` text NOT NULL,
	`kind` text NOT NULL,
	`multiplier` real DEFAULT 1 NOT NULL,
	`no_xp` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `channel_rules_guild_channel` ON `channel_rules` (`guild_id`,`channel_id`);--> statement-breakpoint
CREATE TABLE `event_attendance` (
	`guild_id` text NOT NULL,
	`user_id` text NOT NULL,
	`event_id` integer NOT NULL,
	`day` text NOT NULL,
	PRIMARY KEY(`guild_id`, `user_id`, `event_id`, `day`)
);
--> statement-breakpoint
CREATE TABLE `guild_config` (
	`guild_id` text PRIMARY KEY NOT NULL,
	`message_xp` integer DEFAULT 3 NOT NULL,
	`message_cooldown_sec` integer DEFAULT 60 NOT NULL,
	`voice_presence_xp_per_min` integer DEFAULT 2 NOT NULL,
	`voice_speaking_xp_per_min` integer DEFAULT 5 NOT NULL,
	`ignore_muted_voice` integer DEFAULT true NOT NULL,
	`level_up_channel_id` text,
	`level_up_message` text DEFAULT '🎉 {user} reached level **{level}**!' NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `level_rewards` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`guild_id` text NOT NULL,
	`level` integer NOT NULL,
	`role_id` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `level_rewards_guild_level` ON `level_rewards` (`guild_id`,`level`);--> statement-breakpoint
CREATE TABLE `member_badges` (
	`guild_id` text NOT NULL,
	`user_id` text NOT NULL,
	`badge_key` text NOT NULL,
	`awarded_at` integer DEFAULT (unixepoch()) NOT NULL,
	PRIMARY KEY(`guild_id`, `user_id`, `badge_key`)
);
--> statement-breakpoint
CREATE TABLE `members` (
	`guild_id` text NOT NULL,
	`user_id` text NOT NULL,
	`username` text DEFAULT '' NOT NULL,
	`xp` integer DEFAULT 0 NOT NULL,
	`level` integer DEFAULT 0 NOT NULL,
	`message_count` integer DEFAULT 0 NOT NULL,
	`voice_seconds` integer DEFAULT 0 NOT NULL,
	`speaking_seconds` integer DEFAULT 0 NOT NULL,
	`last_message_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	PRIMARY KEY(`guild_id`, `user_id`)
);
--> statement-breakpoint
CREATE TABLE `multiplier_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`guild_id` text NOT NULL,
	`name` text NOT NULL,
	`multiplier` real DEFAULT 2 NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`counts_attendance` integer DEFAULT false NOT NULL,
	`day_of_week` integer,
	`start_minute` integer,
	`end_minute` integer,
	`starts_at` integer,
	`ends_at` integer,
	`channel_id` text
);
