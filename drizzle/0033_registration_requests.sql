-- Company data from the public sign-up form, kept until the account's email is verified.
-- The company, membership and first invoice are created from this row after verification.
CREATE TABLE IF NOT EXISTS "registration_requests" (
  "user_id" text PRIMARY KEY NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "company_name" text NOT NULL,
  "industry" text NOT NULL,
  "plan_code" text NOT NULL,
  "duration_months" integer DEFAULT 1 NOT NULL,
  "coupon_code" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
