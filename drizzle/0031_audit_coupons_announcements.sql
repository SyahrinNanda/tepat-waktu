CREATE TABLE IF NOT EXISTS "platform_audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_user_id" text REFERENCES "user"("id") ON DELETE set null,
	"actor_name" text NOT NULL,
	"actor_email" text NOT NULL,
	"action" text NOT NULL,
	"company_id" uuid REFERENCES "companies"("id") ON DELETE set null,
	"company_name" text,
	"summary" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "platform_audit_logs_created_idx" ON "platform_audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "platform_audit_logs_company_idx" ON "platform_audit_logs" USING btree ("company_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "platform_audit_logs_action_idx" ON "platform_audit_logs" USING btree ("action","created_at");--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "coupons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"discount_type" text NOT NULL,
	"discount_value" integer NOT NULL,
	"min_duration_months" integer DEFAULT 1 NOT NULL,
	"plan_codes" text[],
	"max_redemptions" integer,
	"per_company_limit" integer DEFAULT 1 NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"active" boolean DEFAULT true NOT NULL,
	"created_by" text REFERENCES "user"("id") ON DELETE set null,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "coupons_code_unique" UNIQUE("code"),
	CONSTRAINT "coupons_type_check" CHECK ("discount_type" IN ('percent', 'fixed')),
	CONSTRAINT "coupons_value_check" CHECK ("discount_value" > 0 AND ("discount_type" <> 'percent' OR "discount_value" <= 100))
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "coupon_redemptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"coupon_id" uuid NOT NULL REFERENCES "coupons"("id") ON DELETE cascade,
	"company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE cascade,
	"order_id" uuid NOT NULL REFERENCES "subscription_orders"("id") ON DELETE cascade,
	"discount_amount" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "coupon_redemptions_order_unique" UNIQUE("order_id")
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "coupon_redemptions_coupon_idx" ON "coupon_redemptions" USING btree ("coupon_id","company_id");--> statement-breakpoint
ALTER TABLE "subscription_orders" ADD COLUMN IF NOT EXISTS "coupon_code" text;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "platform_announcements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"tone" text DEFAULT 'info' NOT NULL,
	"audience" text DEFAULT 'all' NOT NULL,
	"company_ids" uuid[],
	"link_url" text,
	"link_label" text,
	"starts_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ends_at" timestamp with time zone,
	"active" boolean DEFAULT true NOT NULL,
	"created_by" text REFERENCES "user"("id") ON DELETE set null,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "platform_announcements_tone_check" CHECK ("tone" IN ('info', 'feature', 'maintenance', 'warning')),
	CONSTRAINT "platform_announcements_audience_check" CHECK ("audience" IN ('all', 'admins'))
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "platform_announcements_active_idx" ON "platform_announcements" USING btree ("active","starts_at");
