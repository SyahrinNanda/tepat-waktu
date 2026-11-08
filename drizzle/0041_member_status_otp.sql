-- OTP login (Better Auth twoFactor plugin, email OTP) and member status enforcement.
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "two_factor_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "two_factor" (
	"id" text PRIMARY KEY NOT NULL,
	"secret" text NOT NULL,
	"backup_codes" text NOT NULL,
	"user_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade,
	"verified" boolean DEFAULT true,
	"failed_verification_count" integer DEFAULT 0,
	"locked_until" timestamp with time zone
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "two_factor_secret_idx" ON "two_factor" USING btree ("secret");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "two_factor_user_id_idx" ON "two_factor" USING btree ("user_id");--> statement-breakpoint
-- OTP login is off unless an admin turns it on. The old switch had no effect, so existing rows are reset.
ALTER TABLE "company_members" ALTER COLUMN "is_otp_login" SET DEFAULT false;--> statement-breakpoint
UPDATE "company_members" SET "is_otp_login" = false WHERE "is_otp_login" = true;
