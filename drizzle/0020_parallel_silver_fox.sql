CREATE TABLE "payrolls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"month" integer NOT NULL,
	"year" integer NOT NULL,
	"salary_type" text DEFAULT 'Bulan' NOT NULL,
	"quantity" double precision DEFAULT 0 NOT NULL,
	"rate" bigint DEFAULT 0 NOT NULL,
	"total_amount" bigint DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'New' NOT NULL,
	"slip_asset_id" uuid,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "payrolls" ADD CONSTRAINT "payrolls_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payrolls" ADD CONSTRAINT "payrolls_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payrolls" ADD CONSTRAINT "payrolls_slip_asset_id_file_assets_id_fk" FOREIGN KEY ("slip_asset_id") REFERENCES "public"."file_assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payrolls" ADD CONSTRAINT "payrolls_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "payrolls_company_idx" ON "payrolls" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "payrolls_company_year_month_idx" ON "payrolls" USING btree ("company_id","year","month");--> statement-breakpoint
CREATE INDEX "payrolls_employee_idx" ON "payrolls" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "payrolls_company_status_idx" ON "payrolls" USING btree ("company_id","status");