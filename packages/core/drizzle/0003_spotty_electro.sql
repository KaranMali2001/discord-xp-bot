CREATE TABLE `ticket_participants` (
	`guild_id` text NOT NULL,
	`ticket_id` integer NOT NULL,
	`user_id` text NOT NULL,
	`role` text DEFAULT 'owner' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	PRIMARY KEY(`ticket_id`, `user_id`)
);
--> statement-breakpoint
ALTER TABLE `ticket_config` ADD `ticket_channel_id` text;