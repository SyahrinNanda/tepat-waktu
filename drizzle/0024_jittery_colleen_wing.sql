ALTER TABLE "subscription_orders" ADD COLUMN "transaction_type" text DEFAULT 'new' NOT NULL;--> statement-breakpoint
ALTER TABLE "subscription_orders" ADD COLUMN "duration_months" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "subscription_orders" ADD COLUMN "subtotal" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "subscription_orders" ADD COLUMN "discount_amount" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "subscription_orders" ADD COLUMN "admin_fee" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "subscription_orders" ADD COLUMN "payment_method" text;--> statement-breakpoint
ALTER TABLE "subscription_orders" ADD COLUMN "payment_requested_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "subscription_orders" ADD COLUMN "started_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "subscription_orders" ADD COLUMN "ends_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "subscription_orders" ADD COLUMN "cancelled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "subscription_plans" ADD COLUMN "trial_months" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "subscription_plans" ADD COLUMN "recommended" boolean DEFAULT false NOT NULL;--> statement-breakpoint
UPDATE "subscription_orders" SET "subtotal" = "amount" WHERE "subtotal" = 0 AND "amount" > 0;
