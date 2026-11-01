# Catatan prioritas perbaikan

Hasil analisis kode tanggal 1 November 2026. Saat analisis, `tsc --noEmit`, `eslint .`, dan `npm run check:architecture` lolos tanpa error.

## 1. Keamanan login dan keanggotaan perusahaan

- [ ] **Konfirmasi email Supabase wajib aktif.** `getAppSession` di `lib/app-session.ts` mencocokkan identitas Supabase ke akun lokal hanya lewat email. Kalau "Confirm email" dimatikan di dashboard Supabase, siapa pun bisa mendaftar dengan email orang lain lalu masuk sebagai orang tersebut. Kunci pengaturan ini dan tuliskan di `docs/SUPABASE-AUTH.md`.
- [ ] **Tentukan aturan satu user satu perusahaan.** `requireCompany`, `featureContext`, dan `selfAttendanceContext` memakai `.limit(1)` tanpa `orderBy`. Unique index `company_member_unique` berada di `(companyId, userId)`, jadi satu user boleh menjadi anggota banyak perusahaan, dan perusahaan yang terpilih bisa berbeda di setiap request. Pilih salah satu:
  - unique index di `company_members.user_id`, atau
  - cookie perusahaan terpilih seperti yang sudah dipakai superadmin.

## 2. Ketahanan presensi

- [ ] **Retry untuk error serialisasi.** `recordAttendanceEvent` di `features/attendance/server/attendance-service.ts` memakai transaksi `serializable` tanpa menangani kode Postgres `40001`. Saat check-in bersamaan, request bisa gagal dengan HTTP 500. Tambahkan retry 2–3 kali.
- [ ] **Gabungkan logika jadwal kerja.** `getSelfAttendanceStatus` dan `recordAttendanceEvent` menghitung jadwal secara terpisah dengan aturan yang sedikit berbeda: field `enabled` untuk hari libur hanya dicek di salah satunya. Pindahkan ke satu fungsi `resolveSchedule()`.
- [ ] (Catatan) Jadwal karyawan dihubungkan lewat nama divisi (`divisions.name = employees.department`), bukan foreign key, sehingga bisa putus kalau divisi diganti nama.
- [ ] (Catatan) Geofence memakai koordinat dari browser, yang bisa dipalsukan. IP yang dicatat diambil dari `x-forwarded-for` tanpa reverse proxy tepercaya. Keduanya perlu dibereskan sebelum IP whitelist dipakai untuk membatasi akses.

## 3. Bersihkan sisa fitur yang dihapus dan perbarui dokumentasi

- [ ] Putuskan apakah payroll, kasbon, klaim beban, dan laporan keuangan akan kembali. Kalau tidak:
  - buat migrasi untuk membuang tabel `payroll_terms`, `employee_salary_profiles`, `employee_salary_components`, dan `financial_terms`;
  - hapus kategori file `payslip` dan `claim_attachment` di `app/api/files/[id]/route.ts`;
  - bersihkan referensi di `app/dashboard/pengaturan/profile/actions.ts` dan `features/master-data/divisions/server/collection-handler.ts`;
  - hapus CSS `.expense-claim-*` dan `.claim-*` di `app/feature-additions.css`.
- [ ] Perbarui `docs/IMPLEMENTATION-STATUS.md`, yang masih menyebut payroll, kasbon, dan klaim sebagai fitur yang tersambung.
- [ ] Ganti zona waktu yang ditulis langsung di kode (`todayInMakassar()`, default `"Asia/Jakarta"`) dengan zona waktu perusahaan.

## 4. Tes

- [ ] Tes isolasi antar perusahaan pada API: user perusahaan A tidak bisa membaca atau mengubah data perusahaan B.
- [ ] Tes `recordAttendanceEvent`: status terlambat, check-out tanpa check-in, presensi ganda, dan geofence.

## Lain-lain

- Pecah komponen besar: `features/attendance/components/daily-attendance-manager.tsx` (±1.600 baris) dan `features/visits/components/visit-list-manager.tsx` (±800 baris).
- Repo baru punya satu commit, dengan sekitar 130 file berubah atau dihapus di branch `main`. Commit atau pindahkan ke branch tersendiri supaya mudah dilacak.
