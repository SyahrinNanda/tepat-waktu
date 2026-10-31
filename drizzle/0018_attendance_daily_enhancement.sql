ALTER TABLE "attendances" ADD COLUMN IF NOT EXISTS "shift_id" uuid;--> statement-breakpoint
ALTER TABLE "attendances" ADD COLUMN IF NOT EXISTS "check_in_location_id" uuid;--> statement-breakpoint
ALTER TABLE "attendances" ADD COLUMN IF NOT EXISTS "check_out_location_id" uuid;--> statement-breakpoint
ALTER TABLE "attendances" ADD COLUMN IF NOT EXISTS "break_start" time without time zone;--> statement-breakpoint
ALTER TABLE "attendances" ADD COLUMN IF NOT EXISTS "break_end" time without time zone;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "attendances" ADD CONSTRAINT "attendances_shift_id_work_schedules_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."work_schedules"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "attendances" ADD CONSTRAINT "attendances_check_in_location_id_attendance_locations_id_fk" FOREIGN KEY ("check_in_location_id") REFERENCES "public"."attendance_locations"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "attendances" ADD CONSTRAINT "attendances_check_out_location_id_attendance_locations_id_fk" FOREIGN KEY ("check_out_location_id") REFERENCES "public"."attendance_locations"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "attendances_shift_idx" ON "attendances" USING btree ("shift_id");--> statement-breakpoint
ALTER TABLE "attendance_events" ADD COLUMN IF NOT EXISTS "location_id" uuid;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "attendance_events" ADD CONSTRAINT "attendance_events_location_id_attendance_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."attendance_locations"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
