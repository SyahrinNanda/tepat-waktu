CREATE TYPE "public"."platform_role" AS ENUM('user', 'superadmin');--> statement-breakpoint
ALTER TYPE "public"."member_role" ADD VALUE 'general_manager' BEFORE 'manager';--> statement-breakpoint
ALTER TYPE "public"."member_role" ADD VALUE 'hrd' BEFORE 'manager';--> statement-breakpoint
ALTER TYPE "public"."member_role" ADD VALUE 'employee';--> statement-breakpoint
UPDATE "company_members" SET "role" = 'admin' WHERE "role" = 'owner';--> statement-breakpoint
ALTER TABLE "company_members" ALTER COLUMN "role" SET DEFAULT 'admin';--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "platform_role" "platform_role" DEFAULT 'user' NOT NULL;
