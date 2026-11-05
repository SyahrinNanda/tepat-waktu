-- Default zona waktu profil pengguna disamakan dengan default perusahaan (WITA). Nilai yang sudah ada tidak diubah.
ALTER TABLE "user" ALTER COLUMN "timezone" SET DEFAULT 'Asia/Makassar';
