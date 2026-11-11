-- Per-company payslip rules: break length, late and absent (alpa) deductions (11 Nov 2026).
CREATE TABLE IF NOT EXISTS "payroll_settings" (
  "company_id" uuid PRIMARY KEY NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "break_minutes" integer DEFAULT 60 NOT NULL,
  "break_min_work_minutes" integer DEFAULT 240 NOT NULL,
  "late_deduction_mode" text DEFAULT 'none' NOT NULL,
  "late_deduction_amount" bigint DEFAULT 0 NOT NULL,
  "absent_deduction_mode" text DEFAULT 'daily_rate' NOT NULL,
  "absent_deduction_amount" bigint DEFAULT 0 NOT NULL,
  "updated_by" text REFERENCES "user"("id") ON DELETE SET NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
