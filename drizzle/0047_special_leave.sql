-- "Cuti Khusus": a leave category whose kinds (Menikah, Melahirkan, Berduka...) each company defines itself (11 Nov 2026).
ALTER TYPE "leave_type" ADD VALUE IF NOT EXISTS 'special';
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "special_leave_types" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "max_days" integer,
  "paid" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "special_leave_types_company_name_unique" ON "special_leave_types" ("company_id", lower("name"));
--> statement-breakpoint
ALTER TABLE "leave_requests" ADD COLUMN IF NOT EXISTS "special_leave_type_id" uuid REFERENCES "special_leave_types"("id") ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE "leave_requests" ADD COLUMN IF NOT EXISTS "special_leave_name" text;
