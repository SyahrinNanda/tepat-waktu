-- Escalating email resend limits (1 min, 5 min, 1 h, 5 h, 24 h) per purpose and email (11 Nov 2026).
ALTER TABLE "email_send_cooldowns" ADD COLUMN IF NOT EXISTS "send_count" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "email_send_cooldowns" ADD COLUMN IF NOT EXISTS "last_sent_at" timestamp with time zone;
