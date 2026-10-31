ALTER TABLE "company_members" ADD COLUMN IF NOT EXISTS "phone" text;--> statement-breakpoint
ALTER TABLE "company_members" ADD COLUMN IF NOT EXISTS "is_active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "company_members" ADD COLUMN IF NOT EXISTS "is_otp_login" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "company_members" ADD COLUMN IF NOT EXISTS "last_login_at" timestamp with time zone;
