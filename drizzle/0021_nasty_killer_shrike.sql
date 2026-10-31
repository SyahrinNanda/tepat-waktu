CREATE TABLE IF NOT EXISTS "cash_advance_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE cascade,
	"cash_advance_request_id" uuid NOT NULL REFERENCES "cash_advance_requests"("id") ON DELETE cascade,
	"payment_date" date NOT NULL,
	"amount" integer NOT NULL,
	"method" text DEFAULT 'payroll_deduction' NOT NULL,
	"note" text,
	"created_by" text NOT NULL REFERENCES "user"("id") ON DELETE restrict,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "payroll_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payroll_id" uuid NOT NULL REFERENCES "payrolls"("id") ON DELETE cascade,
	"company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE cascade,
	"category" text NOT NULL,
	"name" text NOT NULL,
	"rate" bigint DEFAULT 0 NOT NULL,
	"quantity" double precision DEFAULT 1 NOT NULL,
	"salary_type" text DEFAULT 'bulan' NOT NULL,
	"total_amount" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "payrolls" ADD COLUMN IF NOT EXISTS "compensation_amount" bigint DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "payrolls" ADD COLUMN IF NOT EXISTS "deduction_amount" bigint DEFAULT 0 NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cash_advance_payments_company_date_idx" ON "cash_advance_payments" USING btree ("company_id","payment_date");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cash_advance_payments_request_idx" ON "cash_advance_payments" USING btree ("cash_advance_request_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payroll_items_payroll_idx" ON "payroll_items" USING btree ("payroll_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payroll_items_company_idx" ON "payroll_items" USING btree ("company_id");
