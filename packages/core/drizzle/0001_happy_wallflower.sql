CREATE TABLE IF NOT EXISTS "event_target_members" (
	"guild_id" text NOT NULL,
	"event_id" integer NOT NULL,
	"user_id" text NOT NULL,
	CONSTRAINT "event_target_members_guild_id_event_id_user_id_pk" PRIMARY KEY("guild_id","event_id","user_id")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "event_target_members_event" ON "event_target_members" USING btree ("guild_id","event_id");