# Catatan prioritas perbaikan

Hasil analisis kode tanggal 1 November 2026. Saat analisis, `tsc --noEmit`, `eslint .`, dan `npm run check:architecture` lolos tanpa error.

## 1. Keamanan login dan keanggotaan perusahaan

- [x] ~~**Konfirmasi email Supabase wajib aktif.**~~ Supabase sudah dihapus (5 Nov 2026). Login, verifikasi email, dan reset password kini sepenuhnya lewat Better Auth dengan `requireEmailVerification`; lihat `docs/AUTH.md`.
- [x] **Satu user satu perusahaan** (6 Nov 2026). Unique index `company_members_user_unique` (migrasi `0037`). Menambah user di Pengaturan → Users ditolak jika email sudah dipakai akun di perusahaan lain. Endpoint lama `/api/onboarding` yang tidak dipakai, tetapi memungkinkan user login membuat perusahaan kedua, dihapus.

## 2. Ketahanan presensi

- [x] **Check-in bersamaan** (6 Nov 2026). Uji 12 check-in serentak dengan `serializable` + retry masih menyisakan error, jadi `recordAttendanceEvent` diganti ke *read committed* dengan kunci baris presensi per karyawan per hari (`FOR UPDATE`). Duplikat tetap dicegah unique index. Retry otomatis untuk `40001`/`40P01` dipertahankan sebagai pengaman. Teruji: 30 check-in dan 30 check-out serentak berhasil semua; 5 check-in paralel karyawan yang sama → 1 berhasil, 4 ditolak 409.
- [ ] **Gabungkan logika jadwal kerja.** `getSelfAttendanceStatus` dan `recordAttendanceEvent` menghitung jadwal secara terpisah dengan aturan yang sedikit berbeda: field `enabled` untuk hari libur hanya dicek di salah satunya. Pindahkan ke satu fungsi `resolveSchedule()`.
- [ ] (Catatan) Jadwal karyawan dihubungkan lewat nama divisi (`divisions.name = employees.department`), bukan foreign key, sehingga bisa putus kalau divisi diganti nama.
- [x] **IP whitelist membatasi presensi** (6 Nov 2026). Jika perusahaan punya daftar IP, check-in/out mandiri hanya diterima dari IP itu (dicek sebelum foto diunggah; kamera tidak dibuka jika jaringan tidak diizinkan). IP dibaca dari header proxy tepercaya (`CLIENT_IP_HEADER`, `lib/client-ip.ts`), bukan dari `X-Forwarded-For` paling kiri yang bisa diisi klien; rate limit login Better Auth memakai header yang sama. Input whitelist kini divalidasi (IP, wildcard `192.168.1.*`/`x`, rentang).
- [ ] (Catatan) **Geofence tetap bisa dipalsukan.** Koordinat berasal dari browser, dan aplikasi web tidak bisa membuktikan GPS asli (aplikasi fake GPS atau DevTools bisa mengubahnya). Untuk kantor tetap, aktifkan IP whitelist. Untuk karyawan lapangan, andalkan foto langsung dan peninjauan admin. Pencegahan yang lebih kuat butuh aplikasi native (deteksi mock location).

## 3. Bersihkan sisa fitur yang dihapus dan perbarui dokumentasi

- [x] Payroll lama, kasbon, klaim beban, dan laporan keuangan tidak akan kembali (diputuskan 5 Nov 2026). Selesai lewat migrasi `0034_remove_finance_leftovers`:
  - dibuang: tabel `payroll_terms`, `financial_terms`, `financial_reports`, `cash_advance_requests`, `cash_advance_payments`, `expense_claims`; kolom `employee_salary_components.payroll_term_id`, `payrolls.slip_asset_id`, `divisions.payroll_calculation`; enum `financial_term_type`; kategori file `payslip` dan `claim_attachment`;
  - **dipertahankan**: `employee_salary_profiles`, `employee_salary_components`, `payrolls`, `payroll_items`, karena dipakai fitur Daftar Gaji Karyawan dan Slip Gaji yang masih aktif;
  - referensi di `app/api/files/[id]/route.ts`, `app/dashboard/pengaturan/profile/actions.ts`, `features/master-data/divisions/server/collection-handler.ts`, dan `scripts/seed.ts` dibersihkan; CSS `.expense-claim-*` dan `.claim-*` dihapus.
- [x] `docs/IMPLEMENTATION-STATUS.md` diperbarui sesuai kondisi 5 Nov 2026.
- [x] Zona waktu perusahaan: `todayInMakassar()` dihapus (tidak dipakai), fallback `"Asia/Jakarta"` diganti `resolveTimeZone()` dari `lib/timezone.ts`, rentang 30 hari di Laporan tidak lagi memakai offset `+08:00`, dan tanggal langganan yang dilihat perusahaan (banner, notifikasi, halaman Langganan, halaman langganan berakhir) memakai `companies.timezone`. Default `user.timezone` disamakan menjadi `Asia/Makassar` (migrasi `0035`). Halaman superadmin sengaja tetap WITA sebagai zona waktu platform.

## 4. Tes

- [x] **Tes isolasi antar perusahaan** (6 Nov 2026): `npm run test:isolation` (`scripts/test-tenant-isolation.mjs`, butuh aplikasi berjalan dan `DATABASE_URL`). 115 pemeriksaan pada semua API berdata perusahaan: baca, ubah, hapus, daftar, dan ekspor. Bug yang ditemukan dan sudah diperbaiki: input presensi admin menerima ID shift/lokasi milik perusahaan lain (nama shift/lokasi perusahaan lain muncul di ekspor harian). Juga diperbaiki: ekspor presensi menjawab 500 alih-alih 403, ekspor kunjungan oleh karyawan berisi kunjungan seluruh perusahaan, dan respons error ekspor kunjungan memuat stack trace.
- [ ] Tes `recordAttendanceEvent`: status terlambat, check-out tanpa check-in, presensi ganda, dan geofence.

## 5. Belum diuji: langganan, retensi, dan email pengingat

Fitur Retensi Pelanggan, Laporan Pendapatan, Konversi Trial, dan email pengingat H-5/H-2 sudah diuji di Docker lokal pada 4 November 2026. Dua hal berikut belum diuji:

- [ ] **Pengiriman lewat SMTP sungguhan.** Semua pengujian memakai Mailpit lokal (http://localhost:8025). Setelah mendaftar ke penyedia email (misalnya Brevo atau Resend) dan menyiapkan SPF/DKIM di domain, isi `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, dan `MAIL_FROM` di `.env`. Lalu jalankan `docker compose up -d --build` dan pastikan satu email benar-benar sampai ke inbox, bukan folder spam. Cara mengirimnya: Superadmin → Retensi Pelanggan → "Kirim pengingat yang jatuh tempo", saat ada perusahaan yang paketnya habis dalam 5 hari.
- [ ] **Tampilan di layar HP.** Semua pengujian dilakukan di layar desktop (1280–1440 px). Cek di lebar ±375 px:
  - halaman `/superadmin/retensi`, `/superadmin/pendapatan`, dan `/superadmin/konversi`;
  - popup Perpanjang manual;
  - banner, popup, dan lonceng peringatan masa aktif di dashboard perusahaan;
  - halaman `/langganan-berakhir`.

## Batas karyawan per paket

- [x] (6 Nov 2026) Jumlah karyawan aktif dibatasi `max_employees` paket yang sedang aktif (`features/subscriptions/server/employee-capacity.ts`). Berlaku saat menambah karyawan, mengaktifkan kembali karyawan nonaktif, dan menambah user non-admin (yang otomatis dibuatkan data karyawan). Halaman Tambah Karyawan menampilkan pemakaian (mis. "1 dari 2") atau pesan batas dengan tombol Lihat paket. Perusahaan tanpa paket (data lama) tidak dibatasi.

## Lain-lain

- Pecah komponen besar: `features/attendance/components/daily-attendance-manager.tsx` (±1.600 baris) dan `features/visits/components/visit-list-manager.tsx` (±800 baris).
- Repo baru punya satu commit, dengan sekitar 130 file berubah atau dihapus di branch `main`. Commit atau pindahkan ke branch tersendiri supaya mudah dilacak.

## 6. Fallback email (Brevo → Mailjet → Mailtrap) — belum diuji dengan layanan sungguhan

Logika fallback, penghitung kuota harian, dan jeda saat error sudah diuji dengan Mailpit (termasuk server yang menolak kiriman dan kuota yang habis). Yang belum:

- Uji kirim sungguhan lewat akun Brevo, Mailjet, dan Mailtrap (host/port di `.env.example` perlu dicocokkan dengan dokumentasi masing-masing).
- Setelah aplikasi online, uji daftar akun dan reset password dengan email sungguhan (checklist di `docs/DEPLOY-VPS-COOLIFY.md`).
- Memastikan teks error kuota dari tiap layanan dikenali (`isQuotaError` di `lib/mailer.ts`). Jika tidak, layanan tetap dilewati 5 menit sekali lalu dicoba lagi, dan batas `SMTP_<NAMA>_DAILY_LIMIT` tetap mencegah kiriman berlebih.

## 7. Rencana deploy (saran 6 Nov 2026)

1. Buat perintah pembuat superadmin pertama tanpa data demo (saat ini hanya ada seed yang ikut membuat perusahaan dan akun demo), lalu commit semua perubahan dan push ke repository yang dipakai Coolify.
2. Deploy ke domain uji (mis. `staging.domain-anda.com`) dan jalankan checklist bagian 5 di `docs/DEPLOY-VPS-COOLIFY.md`: email sungguhan lewat Brevo/Mailjet/Mailtrap, upload ke R2, tampilan di HP, IP pengunjung terbaca benar, backup database.
3. Jika checklist lolos, buka untuk beberapa pelanggan awal.

Prasyarat yang sudah siap menurut pemilik (6 Nov 2026): domain ke VPS, akun Brevo/Mailjet/Mailtrap + SPF/DKIM, bucket R2, `BETTER_AUTH_SECRET`, backup database di Coolify. Uji kondisi nyata (SMTP, VPS/Coolify, R2, HP) akan dilakukan langsung di production.
