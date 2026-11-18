# Tukar Divisi ↔ Jabatan (label + nama database) — Desain

Tanggal: 2026-11-18 · Status: disetujui dan diterapkan

## Latar belakang
Jadwal kerja saat ini melekat ke **Divisi**. Studi kasus: dalam satu divisi ada karyawan dengan shift
berbeda, sedangkan karyawan dengan **jabatan** yang sama selalu satu shift. Jadi yang seharusnya
membawa jadwal adalah jabatan.

## Keputusan (dari pemilik produk)
- Tukar **label** "Divisi" ↔ "Jabatan" di seluruh aplikasi.
- Tukar juga **nama di database dan kode**, supaya nama di kode sama dengan yang dilihat pengguna
  (memudahkan pengembangan ke depan).
- **Isi data tidak dipindah**: hanya nama tabel/kolom yang diganti. Data production masih sedikit dan
  tahap percobaan; data lama yang tampil terbalik dapat diterima (admin menyusun ulang).

## Pendekatan yang dipertimbangkan
1. Tukar label saja — paling kecil, tetapi kode `division` berarti jabatan (membingungkan). Ditolak.
2. **Tukar label + rename database & kode** (dipilih) — nama konsisten di semua lapisan.
3. Jadwal per jabatan dengan cadangan divisi — paling aman untuk data lama, tetapi tidak dibutuhkan
   karena data masih percobaan. Ditolak.

## Pemetaan nama
| Sekarang | Sesudah | Arti untuk pengguna |
|---|---|---|
| tabel `divisions` (punya jadwal) | tabel `job_positions` | **Jabatan** |
| tabel `division_schedules`, kolom `division_id` | tabel `job_position_schedules`, kolom `job_position_id` | jadwal per **Jabatan** |
| tabel `job_positions` (tanpa jadwal) | tabel `divisions` | **Divisi** |
| kolom `employees.department` | kolom `employees.position` | **Jabatan** |
| kolom `employees.position` | kolom `employees.department` | **Divisi** |
| Drizzle: `divisions`, `divisionSchedules`, `jobPositions` | `jobPositions`, `jobPositionSchedules`, `divisions` | — |
| indeks/constraint `divisions_*`, `job_positions_*`, `division_schedules_*` | ikut ditukar namanya | — |

Contoh: nilai "Produksi" yang sekarang ada di `divisions`/`employees.department` tetap ada, tetapi
sesudahnya berada di `job_positions`/`employees.position` dan tampil sebagai **Jabatan**.

## Migrasi database (satu file, satu transaksi)
Hanya `ALTER ... RENAME`, tanpa memindah atau menghapus baris:
1. `job_positions` → nama sementara; `divisions` → `job_positions`; nama sementara → `divisions`.
2. `division_schedules` → `job_position_schedules`; kolom `division_id` → `job_position_id`.
3. `employees.department` → sementara; `employees.position` → `department`; sementara → `position`.
4. Ganti nama indeks, unique constraint, foreign key, dan primary key yang memuat nama lama.
5. Verifikasi di akhir migrasi (jumlah baris tiap tabel sama; jadwal tetap terhubung).
Jika ada langkah gagal, seluruh transaksi dibatalkan dan database kembali seperti semula.

## Kode yang ikut berubah (~75 file + 5 file API mobile)
- `db/schema.ts`: nama tabel/kolom/indeks di atas, beserta catatan penjelas.
- Folder fitur ditukar: `features/master-data/divisions` ↔ `features/master-data/positions`.
- Rute halaman ditukar: `/dashboard/master/divisi` ↔ `/dashboard/master/jabatan`;
  API `/api/master/divisions` ↔ `/api/master/positions`.
- Semua pemakai: karyawan (form, detail, daftar), gaji karyawan (edit massal → per
  Jabatan), presensi harian/bulanan & detail, check-in (pilih shift), izin/cuti & sisa cuti, lembur,
  keluhan, slip gaji, perhitungan gaji, ekspor Excel/PDF, pesan error ("jadwal jabatannya").
- Pengaturan → Role: teks "Semua Divisi". Pilihan ini disimpan sebagai JSON di `feature_records` dan
  belum dipakai membatasi akses; kunci JSON lama dibiarkan.
- Skrip tes dan seed (`scripts/*`) disesuaikan.

## API mobile (`app/api/mobile/*`, milik pemilik, belum di-commit)
5 file memakai `department`/`position`/`divisions` dan **akan gagal build** setelah schema berganti
nama. Usulan: ikut disesuaikan (dengan izin pemilik). Nama field JSON tetap `department` (= Divisi) dan
`position` (= Jabatan), sehingga label di aplikasi mobile otomatis sesuai arti baru.

## Deploy production
1. Pastikan versi lama tidak berjalan saat migrasi (aplikasi lama akan error karena nama tabel berubah):
   hentikan/maintenance → jalankan migrasi → jalankan versi baru. Jeda ±1 menit.
2. Migrasi 0053 (aturan gaji per karyawan) dan migrasi baru ini dijalankan bersama, berurutan.
3. Backup database sebelum migrasi.
4. Catatan rilis untuk admin percobaan: susun ulang Jabatan (dengan jadwal), Divisi, lalu data
   karyawan.

## Risiko & penanganan
- Nama yang terlewat di kode → typecheck/build akan gagal sebelum deploy (nama lama tidak ada lagi).
- Label yang terlewat → cari ulang semua teks yang tampil ke pengguna + crawler semua peran.
- Impor kehadiran bulanan tidak memakai kolom divisi/jabatan, jadi tidak terpengaruh (tidak ada fitur impor karyawan).

## Pengujian
Migrasi di database lokal (cek jumlah baris dan relasi jadwal sebelum/sesudah); lint, typecheck,
build; tes isolasi, presensi, perhitungan gaji; crawler admin/karyawan/superadmin/tamu (desktop & HP);
alur: tambah Jabatan dengan beberapa shift → karyawan check-in memilih shift → terlambat dihitung →
slip gaji; ekspor Excel/PDF presensi dan slip.
