-- Existing accounts predate mandatory email verification. Keep their login access.
UPDATE "user" SET "email_verified" = true WHERE "email_verified" = false;
