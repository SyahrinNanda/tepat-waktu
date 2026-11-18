-- Per-employee alpa/late rules (17 Nov 2026). "company" = follow the company's payroll settings.
-- absent_rule "manual_only": only attendance marked Alpa counts; empty days are days off (Libur).
ALTER TABLE "employee_salary_profiles" ADD COLUMN IF NOT EXISTS "absent_rule" text DEFAULT 'company' NOT NULL;
--> statement-breakpoint
ALTER TABLE "employee_salary_profiles" ADD COLUMN IF NOT EXISTS "absent_manual_amount" bigint DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "employee_salary_profiles" ADD COLUMN IF NOT EXISTS "late_rule" text DEFAULT 'company' NOT NULL;
--> statement-breakpoint
ALTER TABLE "employee_salary_profiles" ADD COLUMN IF NOT EXISTS "late_mode" text DEFAULT 'per_day' NOT NULL;
--> statement-breakpoint
ALTER TABLE "employee_salary_profiles" ADD COLUMN IF NOT EXISTS "late_amount" bigint DEFAULT 0 NOT NULL;
