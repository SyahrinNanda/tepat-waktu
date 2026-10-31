INSERT INTO "financial_terms" ("company_id", "name", "type", "active")
SELECT
  "company_id",
  COALESCE(NULLIF("fields"->>'Nama Istilah', ''), NULLIF("fields"->>'Nama', '')),
  CASE
    WHEN lower(COALESCE("fields"->>'Tipe Keuangan', "fields"->>'Tipe', '')) IN ('income', 'pemasukan', 'pendapatan') THEN 'income'::"financial_term_type"
    ELSE 'outcome'::"financial_term_type"
  END,
  lower(COALESCE("status", 'aktif')) NOT IN ('nonaktif', 'inactive')
FROM "feature_records"
WHERE "module" = 'perusahaan/istilah-keuangan'
  AND COALESCE(NULLIF("fields"->>'Nama Istilah', ''), NULLIF("fields"->>'Nama', '')) IS NOT NULL
ON CONFLICT ("company_id", "name") DO NOTHING;

INSERT INTO "financial_reports" ("company_id", "financial_term_id", "amount", "description", "transaction_date", "created_by", "updated_by", "created_at", "updated_at")
SELECT
  record."company_id",
  term."id",
  regexp_replace(COALESCE(record."fields"->>'Nominal', record."fields"->>'Jumlah', '0'), '[^0-9]', '', 'g')::bigint,
  COALESCE(NULLIF(record."fields"->>'Keterangan', ''), NULLIF(record."fields"->>'Deskripsi', ''), 'Migrasi laporan keuangan'),
  CASE WHEN COALESCE(record."fields"->>'Tanggal', '') ~ '^\d{4}-\d{2}-\d{2}$' THEN (record."fields"->>'Tanggal')::date ELSE record."created_at"::date END,
  record."created_by",
  record."updated_by",
  record."created_at",
  record."updated_at"
FROM "feature_records" record
JOIN "financial_terms" term ON term."company_id" = record."company_id"
  AND lower(term."name") = lower(COALESCE(record."fields"->>'Istilah Keuangan', record."fields"->>'Istilah', record."fields"->>'Kategori', ''))
WHERE record."module" = 'perusahaan/laporan-keuangan'
  AND regexp_replace(COALESCE(record."fields"->>'Nominal', record."fields"->>'Jumlah', '0'), '[^0-9]', '', 'g') ~ '^\d+$'
  AND regexp_replace(COALESCE(record."fields"->>'Nominal', record."fields"->>'Jumlah', '0'), '[^0-9]', '', 'g')::bigint > 0;
