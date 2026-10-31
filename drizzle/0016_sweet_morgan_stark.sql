CREATE TYPE "public"."financial_term_type" AS ENUM('income', 'outcome');--> statement-breakpoint
CREATE TABLE "employee_leave_entitlements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"year" integer NOT NULL,
	"maximum_days" integer DEFAULT 12 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "financial_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"financial_term_id" uuid NOT NULL,
	"amount" bigint NOT NULL,
	"description" text NOT NULL,
	"transaction_date" date NOT NULL,
	"created_by" text NOT NULL,
	"updated_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "financial_terms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" text NOT NULL,
	"type" "financial_term_type" NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "employee_leave_entitlements" ADD CONSTRAINT "employee_leave_entitlements_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_leave_entitlements" ADD CONSTRAINT "employee_leave_entitlements_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_reports" ADD CONSTRAINT "financial_reports_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_reports" ADD CONSTRAINT "financial_reports_financial_term_id_financial_terms_id_fk" FOREIGN KEY ("financial_term_id") REFERENCES "public"."financial_terms"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_reports" ADD CONSTRAINT "financial_reports_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_reports" ADD CONSTRAINT "financial_reports_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_terms" ADD CONSTRAINT "financial_terms_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "employee_leave_entitlements_employee_year_unique" ON "employee_leave_entitlements" USING btree ("employee_id","year");--> statement-breakpoint
CREATE INDEX "employee_leave_entitlements_company_year_idx" ON "employee_leave_entitlements" USING btree ("company_id","year");--> statement-breakpoint
CREATE INDEX "financial_reports_company_date_idx" ON "financial_reports" USING btree ("company_id","transaction_date");--> statement-breakpoint
CREATE INDEX "financial_reports_term_idx" ON "financial_reports" USING btree ("financial_term_id");--> statement-breakpoint
CREATE UNIQUE INDEX "financial_terms_company_name_unique" ON "financial_terms" USING btree ("company_id","name");--> statement-breakpoint
CREATE INDEX "financial_terms_company_type_idx" ON "financial_terms" USING btree ("company_id","type");