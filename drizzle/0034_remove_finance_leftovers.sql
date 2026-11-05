-- Payroll lama, kasbon, klaim beban, dan laporan keuangan tidak dipakai lagi (keputusan 5 Nov 2026).
-- Daftar Gaji Karyawan dan Slip Gaji tetap: employee_salary_profiles, employee_salary_components,
-- payrolls, payroll_items, serta enum payroll_calculation dan payroll_term_type tidak disentuh.
DROP TABLE IF EXISTS "cash_advance_payments";
--> statement-breakpoint
DROP TABLE IF EXISTS "cash_advance_requests";
--> statement-breakpoint
DROP TABLE IF EXISTS "expense_claims";
--> statement-breakpoint
DROP TABLE IF EXISTS "financial_reports";
--> statement-breakpoint
DROP TABLE IF EXISTS "financial_terms";
--> statement-breakpoint
-- Selalu kosong sejak Daftar Gaji memakai komponen bebas per karyawan.
ALTER TABLE "employee_salary_components" DROP COLUMN IF EXISTS "payroll_term_id";
--> statement-breakpoint
DROP TABLE IF EXISTS "payroll_terms";
--> statement-breakpoint
-- Slip Gaji dicetak dari data, tidak menyimpan file.
ALTER TABLE "payrolls" DROP COLUMN IF EXISTS "slip_asset_id";
--> statement-breakpoint
-- Cara hitung gaji per divisi dari payroll lama; basis gaji kini diatur per karyawan.
ALTER TABLE "divisions" DROP COLUMN IF EXISTS "payroll_calculation";
--> statement-breakpoint
DROP TYPE IF EXISTS "financial_term_type";
--> statement-breakpoint
-- Kategori file klaim dan slip gaji tidak dipakai (tidak ada file dengan kategori ini).
DELETE FROM "file_assets" WHERE "category" IN ('claim_attachment', 'payslip');
--> statement-breakpoint
ALTER TYPE "file_asset_category" RENAME TO "file_asset_category_old";
--> statement-breakpoint
CREATE TYPE "file_asset_category" AS ENUM ('attendance_photo', 'employee_document', 'announcement_image', 'visit_attachment');
--> statement-breakpoint
ALTER TABLE "file_assets" ALTER COLUMN "category" TYPE "file_asset_category" USING "category"::text::"file_asset_category";
--> statement-breakpoint
DROP TYPE "file_asset_category_old";
