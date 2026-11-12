-- Kontrak Kerja tab on the employee detail page (11 Nov 2026).
CREATE TABLE IF NOT EXISTS "employee_contracts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "employee_id" uuid NOT NULL REFERENCES "employees"("id") ON DELETE CASCADE,
  "contract_type" text NOT NULL,
  "start_date" date NOT NULL,
  "duration_months" integer,
  "note" text,
  "active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "employee_contracts_employee_idx" ON "employee_contracts" ("company_id", "employee_id");
