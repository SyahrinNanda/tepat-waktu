CREATE TABLE IF NOT EXISTS "subscription_reminders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL REFERENCES "subscription_orders"("id") ON DELETE cascade,
	"company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE cascade,
	"level" integer NOT NULL,
	"recipients" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'sending' NOT NULL,
	"attempts" integer DEFAULT 1 NOT NULL,
	"error" text,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscription_reminders_level_check" CHECK ("level" IN (5, 2))
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "subscription_reminders_order_level_idx" ON "subscription_reminders" USING btree ("order_id","level");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "subscription_reminders_company_idx" ON "subscription_reminders" USING btree ("company_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "subscription_orders_verified_idx" ON "subscription_orders" USING btree ("verified_at");
