-- Last time each user opened the notification bell (11 Nov 2026).
CREATE TABLE IF NOT EXISTS "notification_reads" (
  "user_id" text PRIMARY KEY NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
