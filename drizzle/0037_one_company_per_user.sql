-- Satu akun hanya boleh menjadi anggota satu perusahaan. Tanpa aturan ini, query yang mencari
-- "perusahaan milik user" bisa memilih perusahaan berbeda di setiap request.
DROP INDEX IF EXISTS "company_members_user_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "company_members_user_unique" ON "company_members" ("user_id");
