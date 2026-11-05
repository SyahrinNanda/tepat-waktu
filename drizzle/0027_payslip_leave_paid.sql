-- Leave requests can be paid or unpaid; existing "permission" (Izin) requests default to unpaid.
ALTER TABLE "leave_requests" ADD COLUMN IF NOT EXISTS "paid" boolean DEFAULT true NOT NULL;--> statement-breakpoint
UPDATE "leave_requests" SET "paid" = false WHERE "type" = 'permission';--> statement-breakpoint
-- Each employee is paid per hour, per day, or per month.
ALTER TABLE "employee_salary_profiles" ADD COLUMN IF NOT EXISTS "salary_basis" "payroll_calculation" DEFAULT 'monthly' NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payrolls_employee_period_idx" ON "payrolls" USING btree ("employee_id","year","month");
