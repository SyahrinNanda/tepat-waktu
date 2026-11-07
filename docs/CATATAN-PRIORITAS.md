# Catatan prioritas perbaikan

Hasil analisis kode tanggal 1 November 2026. Saat analisis, `tsc --noEmit`, `eslint .`, dan `npm run check:architecture` lolos tanpa error.

## 1. Keamanan login dan keanggotaan perusahaan

- [x] ~~**Konfirmasi email Supabase wajib aktif.**~~ Supabase sudah dihapus (5 Nov 2026). Login, verifikasi email, dan reset password kini sepenuhnya lewat Better Auth dengan `requireEmailVerification`; lihat `docs/AUTH.md`.
- [x] **Satu user satu perusahaan** (6 Nov 2026). Unique index `company_members_user_unique` (migrasi `0037`). Menambah user di Pengaturan → Users ditolak jika email sudah dipakai akun di perusahaan lain. Endpoint lama `/api/onboarding` yang tidak dipakai, tetapi memungkinkan user login membuat perusahaan kedua, dihapus.

## 2. Ketahanan presensi

- [x] **Check-in bersamaan** (6 Nov 2026). Uji 12 check-in serentak dengan `serializable` + retry masih menyisakan error, jadi `recordAttendanceEvent` diganti ke *read committed* dengan kunci baris presensi per karyawan per hari (`FOR UPDATE`). Duplikat tetap dicegah unique index. Retry otomatis untuk `40001`/`40P01` dipertahankan sebagai pengaman. Teruji: 30 check-in dan 30 check-out serentak berhasil semua; 5 check-in paralel karyawan yang sama → 1 berhasil, 4 ditolak 409.
- [ ] **Gabungkan logika jadwal kerja.** `getSelfAttendanceStatus` dan `recordAttendanceEvent` menghitung jadwal secara terpisah dengan aturan yang sedikit berbeda: field `enabled` untuk hari libur hanya dicek di salah satunya. Pindahkan ke satu fungsi `resolveSchedule()`.
- [ ] (Catatan) Jadwal karyawan dihubungkan lewat nama divisi (`divisions.name = employees.department`), bukan foreign key, sehingga bisa putus kalau divisi diganti nama.
- [x] **IP whitelist dihapus permanen** (6 Nov 2026, keputusan pemilik): halaman Pengaturan → IP Whitelist, menu, dan pembatasan presensi berbasis IP dibuang; data lama dihapus lewat migrasi `0038`. IP pengunjung tetap dicatat di log presensi dan dipakai rate limit login, dibaca dari header proxy tepercaya (`CLIENT_IP_HEADER`, `lib/client-ip.ts`).
- [ ] (Catatan) **Geofence tetap bisa dipalsukan.** Koordinat berasal dari browser, dan aplikasi web tidak bisa membuktikan GPS asli (aplikasi fake GPS atau DevTools bisa mengubahnya). Andalkan foto langsung dan peninjauan admin. Pencegahan yang lebih kuat butuh aplikasi native (deteksi mock location).

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

- [ ] **Pengiriman lewat SMTP sungguhan.** Lihat bagian 9 (rencana uji email).
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

## 7. Rencana deploy (diperbarui 7 Nov 2026)

Kerjakan berurutan.

**A. Wajib sebelum deploy pertama**
- [ ] 1. **Commit dan push semua perubahan** di branch `dev` (±40 file/folder belum di-commit per 7 Nov 2026: Midtrans, hapus akun, perbaikan presensi, dll.) ke `SyahrinNanda/tepat-waktu`. Coolify men-deploy dari GitHub, jadi yang belum di-push tidak ikut.
- [x] 2. (7 Nov 2026) **Perintah pembuat superadmin pertama** tanpa data demo: `scripts/create-superadmin.mjs` (`npm run superadmin:create`). Service `migrate` menjalankannya otomatis setelah migrasi bila `SUPERADMIN_EMAIL`/`SUPERADMIN_PASSWORD` diisi dan belum ada superadmin. Diuji: dibuat, deploy ulang dilewati, tanpa env dilewati, `--reset-password`, validasi password, login + halaman `/superadmin` di image production.
- [x] 3. (7 Nov 2026) **Uji migrasi di database kosong** dengan image `migrator`: 40/40 migrasi sukses; kolom (478), index, dan constraint identik dengan database lokal (hanya nama 3 FK `payrolls` berbeda, aturannya sama); 8 paket aktif; 0 perusahaan/karyawan demo.

**B. Saat deploy ke staging** (mis. `staging.domain-anda.com`)
- [ ] 4. Isi environment di Coolify (daftar lengkap di `docs/DEPLOY-VPS-COOLIFY.md`):
  - `BETTER_AUTH_SECRET` dan `BETTER_AUTH_URL`;
  - R2 (`OBJECT_STORAGE_*`);
  - `CLIENT_IP_HEADER`;
  - email: **Brevo, Mailjet, dan Mailtrap ketiganya wajib** (lihat bagian 9);
  - Midtrans **sandbox** (`MIDTRANS_IS_PRODUCTION=false`), belum production.
- [ ] 5. Jalankan checklist staging (bagian 5 di `docs/DEPLOY-VPS-COOLIFY.md` + bagian 9 di sini):
  - email sungguhan (keenam email, tiap layanan, dan fallback);
  - webhook Midtrans asli (Notification URL diisi, paket aktif tanpa membuka halaman hasil; lihat bagian 8);
  - upload foto ke R2;
  - tampilan di HP;
  - IP pengunjung terbaca benar;
  - backup database.

**C. Setelah staging lolos**
- [ ] 6. Ganti ke **Midtrans production** setelah aktivasi selesai (2–3 hari kerja sejak 7 Nov 2026). Cocokkan dulu tarif biaya admin (`paymentAdminFee`) dengan kontrak, lalu uji satu transaksi kecil sungguhan.
- [ ] 7. Buka untuk beberapa pelanggan awal.

**Bisa menyusul setelah live:** pecah komponen besar, tes `recordAttendanceEvent`, gabungkan logika jadwal kerja (bagian 2, 4, dan Lain-lain).

Prasyarat yang sudah siap menurut pemilik (6 Nov 2026): domain ke VPS, akun Brevo/Mailjet/Mailtrap + SPF/DKIM, bucket R2, `BETTER_AUTH_SECRET`, backup database di Coolify. Uji kondisi nyata (SMTP, VPS/Coolify, R2, HP) akan dilakukan langsung di production.

## 8. Midtrans (6 Nov 2026)

Pembayaran paket lewat Midtrans Snap sudah terpasang: `lib/midtrans.ts`, `features/subscriptions/server/midtrans-payments.ts`, webhook `/api/payments/midtrans/notification`, migrasi `0039`.

- Admin memilih metode → biaya admin metode itu ditambahkan ke invoice → jendela Snap hanya menampilkan metode tersebut.
- Webhook diverifikasi dengan signature SHA512, lalu status dibaca ulang dari API status Midtrans sebelum invoice diaktifkan. Pembayaran dari percobaan lama (mis. VA lama) tetap mengaktifkan invoice; notifikasi ganda tidak dobel; nominal di bawah harga paket ditolak.
- Halaman `/dashboard/langganan/pembayaran/berhasil` dan menutup popup menarik status dari Midtrans, jadi paket tetap aktif walau webhook terlambat.
- Semua notifikasi tercatat di tabel `payment_gateway_events`.
- Tanpa `MIDTRANS_SERVER_KEY`/`MIDTRANS_CLIENT_KEY`, aplikasi kembali ke verifikasi manual.

- [x] (7 Nov 2026) Diuji dengan akun **sandbox sungguhan** di lokal: kartu kredit lewat popup Snap (3DS, OTP `112233`) dan VA BCA lewat simulator → paket aktif, email invoice lunas terkirim, banner masa aktif hilang. Webhook diuji dengan notifikasi bertanda tangan server key sandbox (valid diterima, palsu ditolak 401).
- [x] (7 Nov 2026) Tombol "Cek status" + cek otomatis tiap 20 detik di halaman hasil pembayaran; cetak invoice satu halaman A4; label "Biaya admin" tanpa nama metode; error jaringan ke Midtrans (mis. DNS `EAI_AGAIN`) dijawab pesan "coba lagi", bukan crash.

Belum:
- [ ] Webhook dari Midtrans sendiri belum diuji (tidak bisa mencapai localhost). Setelah staging online: isi Notification URL di dashboard sandbox `https://<domain>/api/payments/midtrans/notification`, bayar VA lewat simulator **tanpa** membuka halaman hasil, pastikan paket aktif dan baris muncul di tabel `payment_gateway_events`.
- [ ] Ganti ke key **production** setelah aktivasi Midtrans selesai (email aktivasi 7 Nov 2026: VA, GoPay, QRIS, estimasi 2–3 hari kerja), set `MIDTRANS_IS_PRODUCTION=true` di Coolify, lalu uji satu transaksi kecil sungguhan.
- [ ] Besaran biaya admin di `paymentAdminFee` (`features/subscriptions/plan-rules.ts`) perlu dicocokkan dengan tarif di kontrak Midtrans Anda.
- [ ] Refund/chargeback hanya dicatat; penonaktifan paket dilakukan manual bila perlu.

## 9. Uji email sungguhan (dicatat 7 Nov 2026, belum dikerjakan)

Domain sudah ada, tetapi `.env.local` masih `MAIL_PROVIDERS=mailpit` dan password SMTP Brevo/Mailjet/Mailtrap masih kosong, jadi semua email lokal hanya masuk Mailpit (http://localhost:8025).

Email yang dikirim aplikasi (semua lewat `lib/mailer.ts`):

| # | Email | Pemicu | Penerima | Kode |
|---|---|---|---|---|
| 1 | Verifikasi email | Daftar akun | Pendaftar | `lib/auth.ts`, `lib/registration/auth-emails.ts` |
| 2 | Reset password | "Lupa password" | Pemilik akun | sama |
| 3 | Konfirmasi hapus akun | Form permintaan hapus akun | Pemilik akun | `features/account-requests/server/deletion.ts` |
| 4 | Hasil hapus akun | Superadmin memproses/menolak | Pemilik akun | sama |
| 5 | Pengingat langganan H-5 / H-2 | Scheduler (`REMINDER_SCHEDULER`) atau Superadmin → Retensi → "Kirim pengingat yang jatuh tempo" | Admin perusahaan | `features/subscriptions/server/reminders.ts` |
| 6 | Invoice lunas | Paket aktif (Midtrans atau verifikasi manual superadmin) | Admin perusahaan | `features/subscriptions/server/invoice-email.ts` |

**Keputusan (7 Nov 2026): ketiga layanan (Brevo, Mailjet, Mailtrap) WAJIB diisi sejak deploy staging**, supaya saat kuota harian satu layanan habis atau error, email otomatis pindah ke layanan berikutnya (kapasitas gabungan ±650 email/hari).

Langkah uji:
1. Verifikasi domain pengirim di **ketiga** layanan (Brevo: Senders, Domains & Dedicated IPs → Domains; Mailjet; Mailtrap Sending Domains) sampai statusnya terverifikasi. Pasang DKIM dan DMARC sesuai petunjuk masing-masing.
2. **SPF hanya boleh satu record** per domain: gabungkan `include:` dari ketiga layanan dalam satu TXT `v=spf1 include:... include:... include:... ~all` (nilai persisnya dari dashboard tiap layanan). Record DKIM tetap terpisah per layanan.
3. Isi environment Coolify (server) atau `.env.local` (lokal) sesuai daftar di `docs/DEPLOY-VPS-COOLIFY.md`:
   `MAIL_FROM="TepatWaktu <no-reply@domain-anda>"`, `MAIL_PROVIDERS=brevo,mailjet,mailtrap`, dan `SMTP_BREVO_*`, `SMTP_MAILJET_*`, `SMTP_MAILTRAP_*` lengkap (HOST, PORT, USER, PASS, DAILY_LIMIT). Layanan dengan HOST kosong diabaikan diam-diam.
4. Set `DAILY_LIMIT` sedikit di bawah kuota asli (mis. Brevo 290, Mailjet 190, Mailtrap 140), karena kiriman di luar aplikasi ikut memakai kuota. Hitungan direset 00:00 UTC (07:00 WIB).
5. Picu keenam email di atas ke alamat email asli dan cek inbox (bukan spam). Cek skor di mail-tester.com (target ≥ 9/10).
6. **Uji tiap layanan cadangan**: urutkan sementara `MAIL_PROVIDERS=mailjet` lalu `MAIL_PROVIDERS=mailtrap` dan kirim satu email per layanan (mis. Lupa password), supaya domain dan kredensial terbukti benar sebelum benar-benar dibutuhkan. Lalu kembalikan ke `brevo,mailjet,mailtrap` dan uji fallback: isi password Brevo salah → email harus tetap sampai lewat Mailjet; kembalikan password yang benar.

Catatan: `docker-compose.yml` dulu menimpa `MAIL_*`/`SMTP_*` dari `.env.local` dengan nilai kosong; sudah diperbaiki 7 Nov 2026, kini dibaca langsung dari `.env.local`.
