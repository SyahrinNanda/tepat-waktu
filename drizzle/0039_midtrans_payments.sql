-- Pembayaran paket lewat Midtrans Snap. Satu invoice bisa punya beberapa transaksi Midtrans (mis. ganti metode),
-- masing-masing dengan order_id Midtrans sendiri; yang terakhir disimpan di invoice.
ALTER TABLE "subscription_orders" ADD COLUMN "gateway_order_id" text;--> statement-breakpoint
ALTER TABLE "subscription_orders" ADD COLUMN "snap_token" text;--> statement-breakpoint
ALTER TABLE "subscription_orders" ADD COLUMN "snap_redirect_url" text;--> statement-breakpoint
ALTER TABLE "subscription_orders" ADD COLUMN "gateway_status" text;--> statement-breakpoint
ALTER TABLE "subscription_orders" ADD COLUMN "gateway_payment_type" text;--> statement-breakpoint
ALTER TABLE "subscription_orders" ADD COLUMN "paid_at" timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX "subscription_orders_gateway_order_idx" ON "subscription_orders" ("gateway_order_id");--> statement-breakpoint
CREATE TABLE "payment_gateway_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "order_id" uuid REFERENCES "subscription_orders"("id") ON DELETE SET NULL,
  "gateway_order_id" text NOT NULL,
  "transaction_status" text,
  "payment_type" text,
  "gross_amount" text,
  "signature_valid" boolean NOT NULL,
  "result" text NOT NULL,
  "payload" jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE INDEX "payment_gateway_events_order_idx" ON "payment_gateway_events" ("order_id", "created_at");
