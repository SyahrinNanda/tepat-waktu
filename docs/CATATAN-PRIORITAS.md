# Catatan prioritas perbaikan

Hasil analisis kode tanggal 1 November 2026. Saat analisis, `tsc --noEmit`, `eslint .`, dan `npm run check:architecture` lolos tanpa error.

## 1. Keamanan login dan keanggotaan perusahaan

- [x] ~~**Konfirmasi email Supabase wajib aktif.**~~ Supabase sudah dihapus (5 Nov 2026). Login, verifikasi email, dan reset password kini sepenuhnya lewat Better Auth dengan `requireEmailVerification`; lihat `docs/AUTH.md`.
- [x] **Satu user satu perusahaan** (6 Nov 2026). Unique index `company_members_user_unique` (migrasi `0037`). Menambah user di Pengaturan → Users ditolak jika email sudah dipakai akun di perusahaan lain. Endpoint lama `/api/onboarding` yang tidak dipakai, tetapi memungkinkan user login membuat perusahaan kedua, dihapus.

## 2. Ketahanan presensi

- [x] **Check-in bersamaan** (6 Nov 2026). Uji 12 check-in serentak dengan `serializable` + retry masih menyisakan error, jadi `recordAttendanceEvent` diganti ke *read committed* dengan kunci baris presensi per karyawan per hari (`FOR UPDATE`). Duplikat tetap dicegah unique index. Retry otomatis untuk `40001`/`40P01` dipertahankan sebagai pengaman. Teruji: 30 check-in dan 30 check-out serentak berhasil semua; 5 check-in paralel karyawan yang sama → 1 berhasil, 4 ditolak 409.
- [x] (7 Nov 2026) **Logika jadwal kerja digabung** ke `resolveSchedule()` (`features/attendance/server/attendance-service.ts`), dipakai layar check-in dan pencatatan presensi. Aturan: jadwal aktif divisi → jadwal aktif perusahaan tertua (urutan tetap, dulu acak) → default 08:00–17:00 yang tidak menilai terlambat. Baris hari ini menimpa jam dasar; baris nonaktif = hari libur (tidak pernah terlambat, layar menampilkan "Hari libur").
  - **Bug yang diperbaiki:** jadwal divisi tanpa baris per hari (shift dibuat lewat Master → Shift tanpa diatur di Jam Kerja) dinilai memakai jadwal perusahaan lain, sehingga karyawan yang datang sebelum jam masuk shift-nya tercatat **terlambat**. Terbukti dengan tes terhadap kode lama.
  - Layar check-in dulu tidak menandai hari libur dan menampilkan 08:00 tanpa keterangan saat jadwal belum diatur; kini keduanya diberi keterangan.
  - Slip gaji (`workWeekFor`) kini juga mengabaikan jadwal divisi yang nonaktif, sama seperti presensi.
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
- [x] (7 Nov 2026) **Tes aturan presensi**: `npm run test:attendance` (`scripts/test-attendance.mjs`, butuh aplikasi berjalan). 23 pemeriksaan lewat API check-in karyawan: terlambat / tepat waktu / dalam toleransi, hari libur, jam khusus hari ini, jadwal divisi nonaktif, tanpa divisi, perusahaan tanpa jadwal, check-out sebelum check-in, check-in/out ganda, 6 check-in bersamaan, dan geofence (tanpa koordinat, di luar, di dalam, kelonggaran akurasi GPS dan batas 50 m-nya). Skenario jadwal dibuat relatif terhadap jam saat tes dijalankan; mendekati tengah malam (WIB) skenario waktu dilewati.

## 5. Belum diuji: langganan, retensi, dan email pengingat

Fitur Retensi Pelanggan, Laporan Pendapatan, Konversi Trial, dan email pengingat H-5/H-2 sudah diuji di Docker lokal pada 4 November 2026. Dua hal berikut belum diuji:

- [ ] **Pengiriman lewat SMTP sungguhan.** Lihat bagian 9 (rencana uji email).
- [x] **Tampilan di layar HP.** Semua pengujian dilakukan di layar desktop (1280–1440 px). Cek di lebar ±375 px:
  - (Selesai 8 Nov 2026, lihat bagian 7 langkah 8.) halaman `/superadmin/retensi`, `/superadmin/pendapatan`, dan `/superadmin/konversi`;
  - popup Perpanjang manual;
  - banner, popup, dan lonceng peringatan masa aktif di dashboard perusahaan;
  - halaman `/langganan-berakhir`.

## Batas karyawan per paket

- [x] (6 Nov 2026) Jumlah karyawan aktif dibatasi `max_employees` paket yang sedang aktif (`features/subscriptions/server/employee-capacity.ts`). Berlaku saat menambah karyawan, mengaktifkan kembali karyawan nonaktif, dan menambah user non-admin (yang otomatis dibuatkan data karyawan). Halaman Tambah Karyawan menampilkan pemakaian (mis. "1 dari 2") atau pesan batas dengan tombol Lihat paket. Perusahaan tanpa paket (data lama) tidak dibatasi.

## Lain-lain

- Pecah komponen besar: `features/attendance/components/daily-attendance-manager.tsx` (±1.600 baris) dan `features/visits/components/visit-list-manager.tsx` (±800 baris).
## 6. Fallback email (Brevo → Mailjet → Mailtrap) — belum diuji dengan layanan sungguhan

Logika fallback, penghitung kuota harian, dan jeda saat error sudah diuji dengan Mailpit (termasuk server yang menolak kiriman dan kuota yang habis). Yang belum:

- Uji kirim sungguhan lewat akun Brevo, Mailjet, dan Mailtrap (host/port di `.env.example` perlu dicocokkan dengan dokumentasi masing-masing).
- Setelah aplikasi online, uji daftar akun dan reset password dengan email sungguhan (checklist di `docs/DEPLOY-VPS-COOLIFY.md`).
- Memastikan teks error kuota dari tiap layanan dikenali (`isQuotaError` di `lib/mailer.ts`). Jika tidak, layanan tetap dilewati 5 menit sekali lalu dicoba lagi, dan batas `SMTP_<NAMA>_DAILY_LIMIT` tetap mencegah kiriman berlebih.

## 7. Rencana deploy (diperbarui 8 Nov 2026)

**Keputusan pemilik (8 Nov 2026):**
- **Staging cukup di lokal** (Docker di laptop). Di server hanya ada **satu environment: production**, dari branch `main`. Uji yang butuh server sungguhan (webhook Midtrans, R2, IP, email dari server) dilakukan langsung di production sebelum dibuka untuk pelanggan.
- **Backup database ditangani pemilik** dengan export database setiap hari, jadi tidak masuk checklist.

Kerjakan berurutan.

**A. Wajib sebelum deploy pertama**
- [x] 1. (7 Nov 2026) Commit dan push ke `dev` (commit `750a306`).
- [x] 2. (7 Nov 2026) **Perintah pembuat superadmin pertama** tanpa data demo: `scripts/create-superadmin.mjs` (`npm run superadmin:create`). Service `migrate` menjalankannya otomatis setelah migrasi bila `SUPERADMIN_EMAIL`/`SUPERADMIN_PASSWORD` diisi dan belum ada superadmin.
- [x] 3. (7 Nov 2026) **Uji migrasi di database kosong**: 40/40 migrasi sukses, skema identik dengan database lokal, 8 paket aktif, tanpa data demo.
- [x] 4. (8 Nov 2026) DNS email `tepat-waktu.id` lengkap; Mailjet dan Mailtrap terbukti sampai inbox; urutan `mailjet,mailtrap,brevo` + fallback diuji (bagian 9).
- [x] 5. (8 Nov 2026) Commit dan push perubahan terakhir (perbaikan jadwal presensi, `test:attendance`, urutan email, perbaikan tampilan HP, dokumen), lalu **merge `dev` → `main`** (Coolify production men-deploy dari `main`).
- [x] 6. (8 Nov 2026) Brevo: domain Authenticated, sender `no-reply@tepat-waktu.id` **Verified** (DKIM + DMARC hijau). Email uji #4 langsung dan reset password lewat aplikasi (`MAIL_PROVIDERS=brevo`) diterima Brevo (`250 queued`); tinggal konfirmasi sampai inbox. Setelah terbukti sampai, Brevo boleh dipindah ke depan urutan (keputusan pemilik).
- [ ] 7. (Disarankan, di lokal) **Uji R2 dari lokal**: isi `OBJECT_STORAGE_*` di `.env.local` dengan bucket R2, upload foto presensi/kunjungan, pastikan foto tampil; lalu kembalikan ke SeaweedFS lokal.
- [x] 8. (8 Nov 2026) **Cek tampilan HP (375 × 812, mode mobile)** di lokal: `/superadmin/retensi` + popup Perpanjang manual, `/superadmin/pendapatan`, `/superadmin/konversi`, `/superadmin/langganan`, dashboard admin (popup peringatan, banner, lonceng), `/dashboard/langganan`, `/langganan-berakhir` (karyawan), beranda karyawan. Semua 12 tampilan tanpa scroll horizontal. Diperbaiki (`app/refresh.css`, blok "Mobile fixes"): panel notifikasi lonceng terpotong di kiri; grafik bulanan Pendapatan/Konversi tampak kosong karena membuka bulan terlama (kini mulai dari bulan terbaru); kartu Retensi dipaksa 3 kolom (kini 2); teks banner masa aktif terjepit tombol (tombol pindah ke bawah). Kamera dan GPS check-in tetap perlu dicoba di HP sungguhan setelah deploy (langkah 11).

**B. Deploy production** (domain utama)
- [ ] 9. Isi environment di Coolify (daftar lengkap di `docs/DEPLOY-VPS-COOLIFY.md`): `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `NEXT_PUBLIC_APP_URL` (Build Variable), R2 (`OBJECT_STORAGE_*`), `CLIENT_IP_HEADER`, pencarian lokasi (`GEOAPIFY_API_KEY`, `TOMTOM_API_KEY`, `GEOCODING_USER_AGENT` dengan domain/kontak), email (`MAIL_FROM=TepatWaktu <no-reply@tepat-waktu.id>`, `MAIL_PROVIDERS=mailjet,mailtrap,brevo`, kredensial ketiga layanan), `REMINDER_SCHEDULER=on`, Midtrans **sandbox dulu** (`MIDTRANS_IS_PRODUCTION=false`), `SUPERADMIN_EMAIL`/`SUPERADMIN_PASSWORD`.
- [ ] 10. Deploy, login superadmin, lalu **hapus `SUPERADMIN_PASSWORD`** dari Coolify.
- [ ] 11. Uji di production (dengan perusahaan uji):
  - email dari server (daftar akun, lupa password);
  - webhook Midtrans sandbox: isi Notification URL, bayar VA di simulator tanpa membuka halaman hasil, paket harus aktif (bagian 8);
  - upload foto presensi/kunjungan ke R2;
  - tampilan dan check-in dari HP sungguhan (kamera + lokasi);
  - IP pengunjung tercatat benar (bukan IP proxy).
- [ ] 12. Ganti ke **Midtrans production** setelah aktivasi selesai: cocokkan tarif `paymentAdminFee` dengan kontrak, isi key production + `MIDTRANS_IS_PRODUCTION=true`, ubah Notification URL di dashboard Midtrans live, uji satu transaksi kecil sungguhan.
- [ ] 13. **Bersihkan data uji** di production (perusahaan/akun/invoice uji) sebelum pelanggan masuk.
- [ ] 14. Buka untuk beberapa pelanggan awal.

**Bisa menyusul setelah live:** pecah komponen besar (Lain-lain), jadwal lewat ID divisi alih-alih nama (bagian 2).

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

**Keputusan (8 Nov 2026): urutan `MAIL_PROVIDERS=mailjet,mailtrap,brevo`** (aturan fallback tetap sama). Alasan: Brevo **menerima** email lalu **menolaknya belakangan** ("sender … is not valid") selama domain/sender belum terautentikasi. Aplikasi menganggapnya terkirim, jadi tidak pindah ke layanan lain dan email hilang diam-diam. Mailjet dan Mailtrap sudah terbukti sampai inbox. Brevo boleh dipindah ke depan lagi setelah domain *Authenticated*, sender `no-reply@tepat-waktu.id` aktif, dan email uji lewat Brevo terbukti sampai.

Langkah uji:
1. Verifikasi domain pengirim di **ketiga** layanan (Brevo: Senders, Domains & Dedicated IPs → Domains; Mailjet; Mailtrap Sending Domains) sampai statusnya terverifikasi. Pasang DKIM dan DMARC sesuai petunjuk masing-masing.
2. **SPF hanya boleh satu record** per domain: gabungkan `include:` dari ketiga layanan dalam satu TXT `v=spf1 include:... include:... include:... ~all` (nilai persisnya dari dashboard tiap layanan). Record DKIM tetap terpisah per layanan.
3. Isi environment Coolify (server) atau `.env.local` (lokal) sesuai daftar di `docs/DEPLOY-VPS-COOLIFY.md`:
   `MAIL_FROM="TepatWaktu <no-reply@domain-anda>"`, `MAIL_PROVIDERS=mailjet,mailtrap,brevo`, dan `SMTP_BREVO_*`, `SMTP_MAILJET_*`, `SMTP_MAILTRAP_*` lengkap (HOST, PORT, USER, PASS, DAILY_LIMIT). Layanan dengan HOST kosong diabaikan diam-diam.
4. Set `DAILY_LIMIT` sedikit di bawah kuota asli (mis. Brevo 290, Mailjet 190, Mailtrap 140), karena kiriman di luar aplikasi ikut memakai kuota. Hitungan direset 00:00 UTC (07:00 WIB).
5. Picu keenam email di atas ke alamat email asli dan cek inbox (bukan spam). Cek skor di mail-tester.com (target ≥ 9/10).
6. **Uji tiap layanan cadangan**: urutkan sementara `MAIL_PROVIDERS=mailjet` lalu `MAIL_PROVIDERS=mailtrap` dan kirim satu email per layanan (mis. Lupa password), supaya domain dan kredensial terbukti benar sebelum benar-benar dibutuhkan. Lalu kembalikan ke `mailjet,mailtrap,brevo` dan uji fallback: isi password Mailjet salah → email harus tetap sampai lewat Mailtrap; kembalikan password yang benar.

Catatan: `docker-compose.yml` dulu menimpa `MAIL_*`/`SMTP_*` dari `.env.local` dengan nilai kosong; sudah diperbaiki 7 Nov 2026, kini dibaca langsung dari `.env.local`.

**Hasil uji 8 Nov 2026** (lokal, `MAIL_FROM=no-reply@tepat-waktu.id`, penerima `sharin783@gmail.com` / `sharin783+tepatwaktu@gmail.com`):
- [x] Login SMTP Brevo, Mailjet, Mailtrap: OK.
- [x] Kirim langsung lewat tiap layanan: ketiganya menjawab `250 queued`.
- [x] Lewat aplikasi (`MAIL_PROVIDERS=brevo,mailjet,mailtrap`): reset password, verifikasi email, dan invoice lunas dari **aktivasi manual superadmin** terkirim lewat Brevo.
- [x] Fallback: password Brevo salah → terkirim lewat Mailjet; Brevo + Mailjet salah → lewat Mailtrap. Kegagalan tercatat di `mail_provider_usage` dan layanan dijeda 5 menit.
- [x] Sampai inbox (bukan Spam): **Mailtrap** dan **Mailjet** (API Mailjet: status `opened` untuk 3 pesan uji). **Brevo tidak sampai**: log Brevo "Sending has been rejected because the sender you used no-reply@tepat-waktu.id is not valid".
- [x] **DNS `tepat-waktu.id` lengkap** (8 Nov 2026, sudah menyebar ke 8.8.8.8 dan 1.1.1.1): satu SPF `v=spf1 include:spf.brevo.com include:spf.mailjet.com include:_spf.smtp.mailtrap.live ~all` (3 dari maks. 10 lookup), TXT `brevo-code`, DKIM Brevo (`brevo1/brevo2`), Mailjet (`mailjet._domainkey`), Mailtrap (`rwmt1/rwmt2`), dan DMARC `p=none`. Email uji kedua lewat ketiga layanan: `250 queued`.
- [ ] **Brevo**: domain masih "Your records don't match yet". Setelah *Authenticated*, tambahkan sender `no-reply@tepat-waktu.id` (Senders → Add a sender), kirim ulang email uji, lalu pertimbangkan mengembalikan Brevo ke urutan depan.
- [ ] Setelah beberapa minggu tanpa masalah, pertimbangkan DMARC `p=quarantine` agar domain lebih sulit dipalsukan.
- [ ] `MAIL_PROVIDERS` di `.env.local` masih `mailpit` (sengaja, untuk pengembangan lokal). Di Coolify isi `mailjet,mailtrap,brevo`.

## 10. Undangan user lewat email (8 Nov 2026)

- [x] Pengaturan → Users → Tambah: opsi **"Kirim undangan lewat email"** (default aktif). User menerima email berisi tautan `/undangan?token=...` untuk membuat password sendiri (7 hari, sekali pakai). Label "Menunggu undangan"/"Undangan kedaluwarsa" dan menu "Kirim ulang undangan" di daftar user. Detail: `docs/AUTH.md` → "Undangan user lewat email". Migrasi `0040_user_invitations`.
- [x] Diuji end-to-end di lokal (26 pemeriksaan): email masuk Mailpit, label status, data karyawan tertaut, belum bisa login sebelum membuat password, konfirmasi beda ditolak, password tersimpan + login, tautan sekali pakai, jeda kirim ulang, tautan lama batal setelah kirim ulang, kedaluwarsa, anggota yang dikeluarkan, jalur password manual tetap jalan. Tes isolasi 115/115.
- [x] Sekalian diperbaiki: pesan sukses/gagal setelah menambah user di halaman Users dulu tidak pernah tampil (komponen dibuat ulang setelah refresh).
- [ ] Uji di production dengan email sungguhan setelah deploy (pastikan `BETTER_AUTH_URL` = domain production, karena tautan undangan memakai alamat itu).
- [x] (8 Nov 2026) **Karyawan → Tambah membuat akun + undangan sekaligus** (kotak "Buat akun login & kirim undangan email", default aktif). Kartu "Akun login" di detail karyawan (buat akun / kirim ulang), kolom "Akun Login" di daftar karyawan, sinkron email saat diedit sebelum undangan dipakai. Diuji end-to-end (24 pemeriksaan): akun level Karyawan tertaut, email masuk, status di daftar/detail/Users, perbaikan salah ketik email (tautan lama batal, undangan ke alamat baru), email login tidak diubah setelah aktif, tanpa akun lalu tombol buat akun, jeda kirim ulang, email milik perusahaan lain ditolak tanpa menyentuh akun itu.
- Rencana fitur lain (belum dikerjakan): impor karyawan dari Excel.

## 11. Status user dan OTP Login (8 Nov 2026)

Sebelumnya kedua sakelar di Pengaturan → Users hanya tersimpan dan tidak berpengaruh.

- [x] **Status berlaku.** User nonaktif: semua sesinya langsung diputus, login ditolak dengan pesan "Akun Anda dinonaktifkan oleh admin perusahaan…" (hook `databaseHooks.session.create.before` di `lib/auth.ts`, juga berlaku untuk langkah OTP), dan cookie lama dianggap keluar di semua halaman/API (`getAppSession` → `lib/member-status.ts`).
- [x] **Status akun Administrator hanya bisa diubah Superadmin.** Di Pengaturan → Users sakelar admin terkunci (juga akun sendiri) dan server menolaknya. Superadmin: Super Admin → Kelola Seluruh Akun → kolom **Status** (Aktifkan/Nonaktifkan, tercatat di audit `user.activate`/`user.deactivate`).
- [x] **OTP Login berlaku, default off** (migrasi `0041`: semua anggota lama di-set off, default kolom false). Memakai plugin resmi Better Auth `twoFactor` (email OTP, TOTP dimatikan): setelah password benar, user dengan OTP aktif menerima kode 6 digit lewat email (berlaku 5 menit, disimpan sebagai hash, percobaan dibatasi plugin), opsi "Percayai perangkat ini 30 hari". Sakelar OTP menyinkronkan `user.two_factor_enabled` + baris `two_factor` (`lib/otp-login.ts`; plugin 1.6.23 mensyaratkan baris itu).
- [x] Diuji end-to-end (27 pemeriksaan) + regresi: undangan 26/26, karyawan+akun 24/24, isolasi 115/115, presensi 23/23.
- [ ] Uji OTP dengan email sungguhan di production (kode dikirim lewat Mailjet/Mailtrap/Brevo).
