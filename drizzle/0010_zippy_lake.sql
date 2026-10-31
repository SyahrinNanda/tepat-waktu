CREATE TYPE "public"."payroll_term_type" AS ENUM('compensation', 'deduction');--> statement-breakpoint
CREATE TABLE "payroll_terms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" text NOT NULL,
	"type" "payroll_term_type" NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "payroll_terms" ADD CONSTRAINT "payroll_terms_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "payroll_terms_company_name_unique" ON "payroll_terms" USING btree ("company_id","name");--> statement-breakpoint
CREATE INDEX "payroll_terms_company_type_idx" ON "payroll_terms" USING btree ("company_id","type");