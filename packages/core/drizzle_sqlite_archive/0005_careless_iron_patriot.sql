CREATE TABLE `event_voice_stats` (
	`guild_id` text NOT NULL,
	`user_id` text NOT NULL,
	`event_id` integer NOT NULL,
	`day` text NOT NULL,
	`username` text DEFAULT '' NOT NULL,
	`channel_id` text DEFAULT '' NOT NULL,
	`present_seconds` integer DEFAULT 0 NOT NULL,
	`muted_seconds` integer DEFAULT 0 NOT NULL,
	`speaking_seconds` integer DEFAULT 0 NOT NULL,
	`first_seen_at` integer DEFAULT (unixepoch()) NOT NULL,
	`last_seen_at` integer DEFAULT (unixepoch()) NOT NULL,
	PRIMARY KEY(`guild_id`, `user_id`, `event_id`, `day`)
);
--> statement-breakpoint
CREATE INDEX `event_voice_stats_event` ON `event_voice_stats` (`guild_id`,`event_id`);