CREATE TYPE "public"."salary_component_unit" AS ENUM('hour', 'day', 'month');--> statement-breakpoint
CREATE TABLE "employee_salary_components" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"payroll_term_id" uuid,
	"name" text NOT NULL,
	"type" "payroll_term_type" NOT NULL,
	"unit" "salary_component_unit" NOT NULL,
	"amount" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "employee_salary_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"base_salary" bigint DEFAULT 0 NOT NULL,
	"overtime_rate" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "employee_salary_components" ADD CONSTRAINT "employee_salary_components_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_salary_components" ADD CONSTRAINT "employee_salary_components_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_salary_components" ADD CONSTRAINT "employee_salary_components_payroll_term_id_payroll_terms_id_fk" FOREIGN KEY ("payroll_term_id") REFERENCES "public"."payroll_terms"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_salary_profiles" ADD CONSTRAINT "employee_salary_profiles_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_salary_profiles" ADD CONSTRAINT "employee_salary_profiles_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "employee_salary_components_employee_name_type_unique" ON "employee_salary_components" USING btree ("employee_id","name","type");--> statement-breakpoint
CREATE INDEX "employee_salary_components_company_employee_idx" ON "employee_salary_components" USING btree ("company_id","employee_id");--> statement-breakpoint
CREATE INDEX "employee_salary_components_term_idx" ON "employee_salary_components" USING btree ("payroll_term_id");--> statement-breakpoint
CREATE UNIQUE INDEX "employee_salary_profiles_employee_unique" ON "employee_salary_profiles" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "employee_salary_profiles_company_idx" ON "employee_salary_profiles" USING btree ("company_id");