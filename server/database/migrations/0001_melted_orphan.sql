CREATE TABLE "staged_clips" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"source_type" text NOT NULL,
	"platform" text,
	"source_url" text,
	"storage_key" text NOT NULL,
	"duration_seconds" numeric,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "staged_clips" ADD CONSTRAINT "staged_clips_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "staged_clips_user_idx" ON "staged_clips" USING btree ("user_id","created_at");