-- Permintaan hapus akun: wajib dikonfirmasi pemilik email, lalu ditinjau superadmin.
ALTER TABLE "deletion_requests" ADD COLUMN "user_id" text REFERENCES "user"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "deletion_requests" ADD COLUMN "token_hash" text;--> statement-breakpoint
ALTER TABLE "deletion_requests" ADD COLUMN "token_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "deletion_requests" ADD COLUMN "confirmed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "deletion_requests" ADD COLUMN "processed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "deletion_requests" ADD COLUMN "processed_by" text;--> statement-breakpoint
ALTER TABLE "deletion_requests" ADD COLUMN "note" text;--> statement-breakpoint
CREATE UNIQUE INDEX "deletion_requests_token_idx" ON "deletion_requests" ("token_hash");--> statement-breakpoint
CREATE INDEX "deletion_requests_status_idx" ON "deletion_requests" ("status", "created_at");
