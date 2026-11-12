-- Cuti Khusus rules (11 Nov 2026): fixed duration in working days. Requests store the working days they cover.
ALTER TABLE "special_leave_types" RENAME COLUMN "max_days" TO "duration_days";
--> statement-breakpoint
ALTER TABLE "leave_requests" ADD COLUMN IF NOT EXISTS "work_days" integer;
