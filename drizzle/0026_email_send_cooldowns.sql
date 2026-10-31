CREATE TABLE IF NOT EXISTS "email_send_cooldowns" (
  "email_hash" text PRIMARY KEY NOT NULL,
  "next_allowed_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
