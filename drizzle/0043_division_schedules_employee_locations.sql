-- A division may use several work schedules; divisions.schedule_id stays the primary one (10 Nov 2026).
CREATE TABLE IF NOT EXISTS "division_schedules" (
  "division_id" uuid NOT NULL REFERENCES "divisions"("id") ON DELETE CASCADE,
  -- CASCADE so deleting a whole company (which removes divisions and schedules together) works.
  -- Deleting a single schedule that a division still uses is refused by the shift API instead.
  "schedule_id" uuid NOT NULL REFERENCES "work_schedules"("id") ON DELETE CASCADE,
  "position" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "division_schedules_division_id_schedule_id_pk" PRIMARY KEY ("division_id", "schedule_id")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "division_schedules_schedule_idx" ON "division_schedules" ("schedule_id");
--> statement-breakpoint
INSERT INTO "division_schedules" ("division_id", "schedule_id", "position")
SELECT "id", "schedule_id", 0 FROM "divisions" WHERE "schedule_id" IS NOT NULL
ON CONFLICT DO NOTHING;
--> statement-breakpoint
-- "Lokasi Tertentu": the locations an employee may check in at when all_attendance_locations is off.
CREATE TABLE IF NOT EXISTS "employee_attendance_locations" (
  "employee_id" uuid NOT NULL REFERENCES "employees"("id") ON DELETE CASCADE,
  "location_id" uuid NOT NULL REFERENCES "attendance_locations"("id") ON DELETE CASCADE,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "employee_attendance_locations_employee_id_location_id_pk" PRIMARY KEY ("employee_id", "location_id")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "employee_attendance_locations_location_idx" ON "employee_attendance_locations" ("location_id");
