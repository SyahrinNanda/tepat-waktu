INSERT INTO "employee_salary_profiles" ("company_id", "employee_id", "base_salary", "overtime_rate")
SELECT
  "company_id",
  ("fields"->>'ID Karyawan')::uuid,
  CASE WHEN COALESCE("fields"->>'Gaji Pokok', '') ~ '^\d+$' THEN ("fields"->>'Gaji Pokok')::bigint ELSE 0 END,
  CASE WHEN COALESCE("fields"->>'Upah Lembur', '') ~ '^\d+$' THEN ("fields"->>'Upah Lembur')::bigint ELSE 0 END
FROM "feature_records"
WHERE "module" = 'karyawan/gaji'
  AND COALESCE("fields"->>'ID Karyawan', '') ~ '^[0-9a-fA-F-]{36}$'
ON CONFLICT ("employee_id") DO NOTHING;

INSERT INTO "employee_salary_components" ("company_id", "employee_id", "name", "type", "unit", "amount")
SELECT "company_id", ("fields"->>'ID Karyawan')::uuid, 'Kompensasi Lama', 'compensation', 'month', ("fields"->>'Kompensasi')::bigint
FROM "feature_records"
WHERE "module" = 'karyawan/gaji'
  AND COALESCE("fields"->>'ID Karyawan', '') ~ '^[0-9a-fA-F-]{36}$'
  AND COALESCE("fields"->>'Kompensasi', '') ~ '^\d+$'
  AND ("fields"->>'Kompensasi')::bigint > 0
ON CONFLICT ("employee_id", "name", "type") DO NOTHING;

INSERT INTO "employee_salary_components" ("company_id", "employee_id", "name", "type", "unit", "amount")
SELECT "company_id", ("fields"->>'ID Karyawan')::uuid, 'Potongan Lama', 'deduction', 'month', ("fields"->>'Potongan')::bigint
FROM "feature_records"
WHERE "module" = 'karyawan/gaji'
  AND COALESCE("fields"->>'ID Karyawan', '') ~ '^[0-9a-fA-F-]{36}$'
  AND COALESCE("fields"->>'Potongan', '') ~ '^\d+$'
  AND ("fields"->>'Potongan')::bigint > 0
ON CONFLICT ("employee_id", "name", "type") DO NOTHING;
