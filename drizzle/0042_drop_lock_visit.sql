-- "Kunci Kunjungan" was never enforced and is removed from the employee list (8 Nov 2026).
ALTER TABLE "employees" DROP COLUMN IF EXISTS "lock_visit";
