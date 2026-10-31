CREATE TYPE "public"."payroll_calculation" AS ENUM('hourly', 'daily', 'monthly');--> statement-breakpoint
CREATE TABLE "divisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" text NOT NULL,
	"schedule_id" uuid,
	"payroll_calculation" "payroll_calculation" DEFAULT 'monthly' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "work_schedule_days" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"schedule_id" uuid NOT NULL,
	"day_of_week" integer NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"start_time" time NOT NULL,
	"end_time" time NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "work_schedules" ADD COLUMN "active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "divisions" ADD CONSTRAINT "divisions_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "divisions" ADD CONSTRAINT "divisions_schedule_id_work_schedules_id_fk" FOREIGN KEY ("schedule_id") REFERENCES "public"."work_schedules"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_schedule_days" ADD CONSTRAINT "work_schedule_days_schedule_id_work_schedules_id_fk" FOREIGN KEY ("schedule_id") REFERENCES "public"."work_schedules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "divisions_company_name_unique" ON "divisions" USING btree ("company_id","name");--> statement-breakpoint
CREATE INDEX "divisions_company_idx" ON "divisions" USING btree ("company_id","active");--> statement-breakpoint
CREATE INDEX "divisions_schedule_idx" ON "divisions" USING btree ("schedule_id");--> statement-breakpoint
CREATE UNIQUE INDEX "work_schedule_days_schedule_day_unique" ON "work_schedule_days" USING btree ("schedule_id","day_of_week");--> statement-breakpoint
CREATE INDEX "work_schedule_days_schedule_idx" ON "work_schedule_days" USING btree ("schedule_id");--> statement-breakpoint
CREATE UNIQUE INDEX "work_schedules_company_name_unique" ON "work_schedules" USING btree ("company_id","name");