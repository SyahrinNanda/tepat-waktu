-- better-auth 1.7 only accepts a password account whose account_id equals the user id. Older code stored
-- the email there after a profile change, so those people could no longer sign in.
UPDATE "account" SET "account_id" = "user_id", "updated_at" = now()
WHERE "provider_id" = 'credential' AND "account_id" <> "user_id";
