CREATE TABLE `ticket_attachments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`ticket_id` integer NOT NULL,
	`guild_id` text NOT NULL,
	`filename` text DEFAULT 'image' NOT NULL,
	`content_type` text DEFAULT 'application/octet-stream' NOT NULL,
	`size_bytes` integer DEFAULT 0 NOT NULL,
	`data` blob NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ticket_attachments_ticket` ON `ticket_attachments` (`ticket_id`);--> statement-breakpoint
CREATE TABLE `ticket_config` (
	`guild_id` text PRIMARY KEY NOT NULL,
	`panel_channel_id` text,
	`mod_channel_id` text,
	`panel_message_id` text,
	`enabled` integer DEFAULT true NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `tickets` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`guild_id` text NOT NULL,
	`user_id` text NOT NULL,
	`username` text DEFAULT '' NOT NULL,
	`subject` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`mod_message_id` text,
	`status` text DEFAULT 'open' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`resolved_at` integer
);
--> statement-breakpoint
CREATE INDEX `tickets_guild_status` ON `tickets` (`guild_id`,`status`);