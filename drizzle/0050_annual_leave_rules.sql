-- Cuti Tahunan per work-anniversary period with company rules (12 Nov 2026).
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "annual_leave_days" integer DEFAULT 12 NOT NULL;
--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "annual_leave_eligibility" text DEFAULT 'immediate' NOT NULL;
--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "annual_leave_carry_over" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "annual_leave_carry_over_max" integer;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "leave_requests_employee_type_idx" ON "leave_requests" ("employee_id", "type", "start_date");
