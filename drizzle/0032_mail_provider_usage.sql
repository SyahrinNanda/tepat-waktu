-- Daily send counters per email provider (Brevo, Mailjet, Mailtrap, ...) for SMTP fallback.
-- `day` is the UTC date: most providers reset their daily quota at 00:00 UTC.
CREATE TABLE IF NOT EXISTS "mail_provider_usage" (
  "provider" text NOT NULL,
  "day" date NOT NULL,
  "sent" integer DEFAULT 0 NOT NULL,
  "failed" integer DEFAULT 0 NOT NULL,
  "blocked_until" timestamp with time zone,
  "last_error" text,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "mail_provider_usage_pk" PRIMARY KEY ("provider", "day")
);
--> statement-breakpoint
ALTER TABLE "subscription_reminders" ADD COLUMN IF NOT EXISTS "provider" text;
