CREATE TYPE "public"."attendance_event_source" AS ENUM('self', 'admin', 'superadmin');--> statement-breakpoint
CREATE TYPE "public"."attendance_event_type" AS ENUM('check_in', 'check_out');--> statement-breakpoint
CREATE TYPE "public"."file_asset_category" AS ENUM('attendance_photo', 'employee_document', 'claim_attachment', 'payslip');--> statement-breakpoint
CREATE TABLE "attendance_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attendance_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"type" "attendance_event_type" NOT NULL,
	"source" "attendance_event_source" NOT NULL,
	"photo_asset_id" uuid,
	"occurred_at" timestamp with time zone NOT NULL,
	"client_captured_at" timestamp with time zone,
	"latitude" double precision,
	"longitude" double precision,
	"accuracy_meters" double precision,
	"ip_address" text,
	"user_agent" text,
	"note" text,
	"recorded_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "file_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"owner_employee_id" uuid,
	"uploaded_by" text NOT NULL,
	"category" "file_asset_category" NOT NULL,
	"bucket" text NOT NULL,
	"object_key" text NOT NULL,
	"original_name" text NOT NULL,
	"content_type" text NOT NULL,
	"byte_size" integer NOT NULL,
	"checksum_sha256" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "attendances" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "user_id" text;--> statement-breakpoint
ALTER TABLE "attendance_events" ADD CONSTRAINT "attendance_events_attendance_id_attendances_id_fk" FOREIGN KEY ("attendance_id") REFERENCES "public"."attendances"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_events" ADD CONSTRAINT "attendance_events_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_events" ADD CONSTRAINT "attendance_events_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_events" ADD CONSTRAINT "attendance_events_photo_asset_id_file_assets_id_fk" FOREIGN KEY ("photo_asset_id") REFERENCES "public"."file_assets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_events" ADD CONSTRAINT "attendance_events_recorded_by_user_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_assets" ADD CONSTRAINT "file_assets_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_assets" ADD CONSTRAINT "file_assets_owner_employee_id_employees_id_fk" FOREIGN KEY ("owner_employee_id") REFERENCES "public"."employees"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_assets" ADD CONSTRAINT "file_assets_uploaded_by_user_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "attendance_event_type_unique" ON "attendance_events" USING btree ("attendance_id","type");--> statement-breakpoint
CREATE INDEX "attendance_events_company_date_idx" ON "attendance_events" USING btree ("company_id","occurred_at");--> statement-breakpoint
CREATE INDEX "attendance_events_employee_idx" ON "attendance_events" USING btree ("employee_id","occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "file_assets_object_key_unique" ON "file_assets" USING btree ("object_key");--> statement-breakpoint
CREATE INDEX "file_assets_company_idx" ON "file_assets" USING btree ("company_id","category");--> statement-breakpoint
CREATE INDEX "file_assets_owner_employee_idx" ON "file_assets" USING btree ("owner_employee_id");--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "employees_company_user_unique" ON "employees" USING btree ("company_id","user_id");