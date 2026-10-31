CREATE TYPE "public"."attendance_location_type" AS ENUM('headquarters', 'branch', 'warehouse', 'other');--> statement-breakpoint
CREATE TABLE "attendance_locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" text NOT NULL,
	"type" "attendance_location_type" DEFAULT 'headquarters' NOT NULL,
	"address" text NOT NULL,
	"latitude" double precision NOT NULL,
	"longitude" double precision NOT NULL,
	"radius_meters" integer DEFAULT 100 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_positions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "visit_location_employees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"visit_location_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "visit_locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" text NOT NULL,
	"owner_name" text NOT NULL,
	"email" text,
	"phone" text NOT NULL,
	"address" text NOT NULL,
	"latitude" double precision NOT NULL,
	"longitude" double precision NOT NULL,
	"radius_meters" integer DEFAULT 100 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "attendance_locations" ADD CONSTRAINT "attendance_locations_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_positions" ADD CONSTRAINT "job_positions_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visit_location_employees" ADD CONSTRAINT "visit_location_employees_visit_location_id_visit_locations_id_fk" FOREIGN KEY ("visit_location_id") REFERENCES "public"."visit_locations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visit_location_employees" ADD CONSTRAINT "visit_location_employees_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visit_locations" ADD CONSTRAINT "visit_locations_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "attendance_locations_company_name_unique" ON "attendance_locations" USING btree ("company_id","name");--> statement-breakpoint
CREATE INDEX "attendance_locations_company_idx" ON "attendance_locations" USING btree ("company_id","active");--> statement-breakpoint
CREATE UNIQUE INDEX "job_positions_company_name_unique" ON "job_positions" USING btree ("company_id","name");--> statement-breakpoint
CREATE INDEX "job_positions_company_idx" ON "job_positions" USING btree ("company_id","active");--> statement-breakpoint
CREATE UNIQUE INDEX "visit_location_employee_unique" ON "visit_location_employees" USING btree ("visit_location_id","employee_id");--> statement-breakpoint
CREATE INDEX "visit_location_employees_location_idx" ON "visit_location_employees" USING btree ("visit_location_id");--> statement-breakpoint
CREATE INDEX "visit_location_employees_employee_idx" ON "visit_location_employees" USING btree ("employee_id");--> statement-breakpoint
CREATE UNIQUE INDEX "visit_locations_company_name_unique" ON "visit_locations" USING btree ("company_id","name");--> statement-breakpoint
CREATE INDEX "visit_locations_company_idx" ON "visit_locations" USING btree ("company_id","active");