ALTER TABLE "subscription_plans" ADD COLUMN IF NOT EXISTS "trial_days" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "subscription_plans" ADD COLUMN IF NOT EXISTS "company_id" uuid REFERENCES "companies"("id") ON DELETE cascade;--> statement-breakpoint
ALTER TABLE "subscription_orders" ADD COLUMN IF NOT EXISTS "duration_days" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "subscription_plans_company_idx" ON "subscription_plans" USING btree ("company_id");--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "custom_plan_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE cascade,
	"requested_by" text NOT NULL REFERENCES "user"("id"),
	"employee_count" integer NOT NULL,
	"proposed_price_per_employee" integer NOT NULL,
	"duration_months" integer DEFAULT 12 NOT NULL,
	"note" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"agreed_employee_count" integer,
	"agreed_price_per_employee" integer,
	"review_note" text,
	"plan_id" uuid REFERENCES "subscription_plans"("id"),
	"order_id" uuid REFERENCES "subscription_orders"("id"),
	"reviewed_by" text REFERENCES "user"("id"),
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "custom_plan_requests_employee_min" CHECK ("employee_count" > 1000),
	CONSTRAINT "custom_plan_requests_price_floor" CHECK ("proposed_price_per_employee" >= 6500 AND ("agreed_price_per_employee" IS NULL OR "agreed_price_per_employee" >= 6500))
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "custom_plan_requests_company_idx" ON "custom_plan_requests" USING btree ("company_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "custom_plan_requests_status_idx" ON "custom_plan_requests" USING btree ("status");--> statement-breakpoint
INSERT INTO "subscription_plans" ("code", "name", "monthly_price", "max_employees", "trial_months", "trial_days", "recommended", "description", "active") VALUES
	('free', 'Free Trial', 0, 5, 0, 14, false, 'Coba seluruh fitur gratis selama 14 hari', true),
	('micro', 'Micro', 97000, 10, 0, 0, false, 'Untuk usaha mikro hingga 10 karyawan', true),
	('small', 'Small', 237000, 25, 0, 0, false, 'Untuk usaha kecil hingga 25 karyawan', true),
	('growth', 'Growth', 458000, 50, 0, 0, true, 'Untuk perusahaan yang sedang bertumbuh hingga 50 karyawan', true),
	('mid-size', 'Mid-size', 872000, 100, 0, 0, false, 'Untuk perusahaan menengah hingga 100 karyawan', true),
	('expand', 'Expand', 1648000, 200, 0, 0, false, 'Untuk perusahaan yang berekspansi hingga 200 karyawan', true),
	('pro', 'Pro', 3849000, 500, 0, 0, false, 'Untuk perusahaan besar hingga 500 karyawan', true),
	('enterprise', 'Enterprise', 7150000, 1000, 0, 0, false, 'Untuk korporasi hingga 1.000 karyawan', true)
ON CONFLICT ("code") DO UPDATE SET "name" = EXCLUDED."name", "monthly_price" = EXCLUDED."monthly_price", "max_employees" = EXCLUDED."max_employees", "trial_months" = EXCLUDED."trial_months", "trial_days" = EXCLUDED."trial_days", "recommended" = EXCLUDED."recommended", "description" = EXCLUDED."description", "active" = true, "company_id" = NULL;--> statement-breakpoint
-- Old tiers stay in the table (orders and companies still reference them) but are no longer sold.
UPDATE "subscription_plans" SET "active" = false, "recommended" = false WHERE "company_id" IS NULL AND "code" NOT IN ('free', 'micro', 'small', 'growth', 'mid-size', 'expand', 'pro', 'enterprise');
