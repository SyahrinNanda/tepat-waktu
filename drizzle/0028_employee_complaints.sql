DO $$ BEGIN
  CREATE TYPE "public"."complaint_category" AS ENUM('sexual_harassment', 'bullying', 'toxic_environment', 'discrimination', 'violence', 'abuse_of_power', 'safety', 'salary_rights', 'facilities', 'other');
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."complaint_status" AS ENUM('new', 'reviewing', 'in_progress', 'resolved', 'rejected');
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "employee_complaints" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE cascade,
  "ticket_code" text NOT NULL,
  "category" "complaint_category" NOT NULL,
  "title" text NOT NULL,
  "description" text NOT NULL,
  "incident_date" date,
  "incident_location" text,
  "involved_parties" text,
  "anonymous" boolean DEFAULT false NOT NULL,
  "reporter_key" text NOT NULL,
  "reporter_user_id" text REFERENCES "user"("id") ON DELETE set null,
  "reporter_name" text,
  "status" "complaint_status" DEFAULT 'new' NOT NULL,
  "response_note" text,
  "internal_note" text,
  "handled_by" text REFERENCES "user"("id") ON DELETE set null,
  "handled_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "employee_complaints_company_ticket_unique" ON "employee_complaints" USING btree ("company_id","ticket_code");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "employee_complaints_company_status_idx" ON "employee_complaints" USING btree ("company_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "employee_complaints_company_created_idx" ON "employee_complaints" USING btree ("company_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "employee_complaints_reporter_idx" ON "employee_complaints" USING btree ("company_id","reporter_key");
