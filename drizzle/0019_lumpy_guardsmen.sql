ALTER TYPE "public"."file_asset_category" ADD VALUE 'visit_attachment';--> statement-breakpoint
CREATE TABLE "visit_attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"visit_id" uuid NOT NULL,
	"asset_id" uuid NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "visits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"location_id" uuid,
	"visit_date" date NOT NULL,
	"visit_time" time NOT NULL,
	"outlet_name" text NOT NULL,
	"latitude" double precision,
	"longitude" double precision,
	"note" text,
	"status" text DEFAULT 'Terjadwal' NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "visit_attachments" ADD CONSTRAINT "visit_attachments_visit_id_visits_id_fk" FOREIGN KEY ("visit_id") REFERENCES "public"."visits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visit_attachments" ADD CONSTRAINT "visit_attachments_asset_id_file_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."file_assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visits" ADD CONSTRAINT "visits_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visits" ADD CONSTRAINT "visits_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visits" ADD CONSTRAINT "visits_location_id_visit_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."visit_locations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visits" ADD CONSTRAINT "visits_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "visit_attachments_visit_asset_unique" ON "visit_attachments" USING btree ("visit_id","asset_id");--> statement-breakpoint
CREATE INDEX "visit_attachments_visit_idx" ON "visit_attachments" USING btree ("visit_id");--> statement-breakpoint
CREATE INDEX "visits_company_date_idx" ON "visits" USING btree ("company_id","visit_date");--> statement-breakpoint
CREATE INDEX "visits_employee_date_idx" ON "visits" USING btree ("employee_id","visit_date");--> statement-breakpoint
