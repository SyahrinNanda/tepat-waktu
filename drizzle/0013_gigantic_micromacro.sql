ALTER TABLE "employees" ADD COLUMN "lock_location" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "lock_photo" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "lock_visit" boolean DEFAULT true NOT NULL;