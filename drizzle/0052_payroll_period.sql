-- Payroll period start day per company (1 = calendar month) and the dates each locked slip covered (14 Nov 2026).
ALTER TABLE "payroll_settings" ADD COLUMN IF NOT EXISTS "period_start_day" integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
ALTER TABLE "payrolls" ADD COLUMN IF NOT EXISTS "period_start" date;
--> statement-breakpoint
ALTER TABLE "payrolls" ADD COLUMN IF NOT EXISTS "period_end" date;
