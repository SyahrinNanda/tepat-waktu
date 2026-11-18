# Aturan alpa & terlambat per karyawan, Perhitungan Gaji dan Aturan Cuti di Master Data

Disetujui pemilik produk 2026-11-17.

## Tujuan
Sebagian karyawan (terutama bergaji harian) punya jadwal dan hari libur yang berubah tiap pekan. Jadwal kerja di
sistem berlaku per divisi, sehingga hari libur mereka terhitung "alpa" otomatis. Pemilik ingin:
- alpa/terlambat bisa diatur per karyawan di Gaji Karyawan;
- untuk karyawan tersebut hari kosong tampil sebagai **Libur**, dan alpa dicatat **manual** oleh admin
  (status "Alpa" di presensi) supaya laporan tetap membedakan Hadir / Terlambat / Izin-Cuti / Alpa / Libur;
- tidak ada karyawan yang "lolos" dari alpa hanya karena digaji harian.
- Pengaturan Perhitungan Gaji dan Aturan Cuti pindah ke menu Master Data.

Non-goal: roster/jadwal shift per karyawan per pekan (bisa ditambah nanti). Anti-goal: gaji karyawan lama berubah
tanpa admin mengubah apa pun.

## Pendekatan
- Dipilih: aturan perusahaan tetap jadi bawaan; setiap karyawan punya pilihan "Ikuti perusahaan" atau aturan khusus.
- Ditolak: semua aturan pindah ke per karyawan (beban setup besar, bentrok dengan Edit Massal).
- Ditunda: roster per karyawan (paling akurat, tapi admin harus mengisi jadwal tiap pekan).

## Desain
1. Menu Master Data: "Perhitungan Gaji" (`/dashboard/master/perhitungan-gaji`, halaman lama dipindah) dan
   "Aturan Cuti" (`/dashboard/master/aturan-cuti`, popup Laporan Cuti dijadikan halaman). Alamat/tombol lama
   mengarah ke alamat baru. Akses mengikuti Master Data (admin, general manager, HRD).
2. `employee_salary_profiles` mendapat kolom (default = ikuti perusahaan):
   - `absent_rule`: `company` | `manual_only`
   - `absent_manual_amount`: Rp per hari alpa manual (0 = tidak dipotong), dipakai saat `manual_only`
   - `late_rule`: `company` | `none` | `custom`
   - `late_mode`: `per_minute` | `per_hour` | `per_day`, `late_amount`: Rp (dipakai saat `custom`)
   Diatur di Gaji Karyawan per karyawan. Edit Massal per divisi tidak mengubah kolom ini.
3. Perhitungan slip:
   - `company`: perilaku sekarang (hari kerja tanpa presensi/izin = alpa, potongan sesuai aturan perusahaan).
   - `manual_only`: hanya presensi berstatus Alpa yang dihitung alpa; hari kosong = libur, tanpa potongan.
     Potongan = jumlah alpa manual × `absent_manual_amount`. Untuk gaji per hari/per jam hari libur memang tidak
     dibayar; untuk gaji bulanan hari libur tidak memotong gaji.
   - Terlambat: `company` = aturan perusahaan, `none` = tidak dipotong, `custom` = mode & nominal karyawan.
   - Slip yang sudah dikunci tidak dihitung ulang.
4. Laporan Kehadiran Harian & Bulanan: untuk karyawan `manual_only`, hari tanpa catatan tampil "Libur", bukan
   "Alpa"; total alpa hanya dari alpa manual.

## Diserahkan ke pembuat
Penamaan komponen, letak UI di Gaji Karyawan (modal/kolom), migrasi bernomor berikutnya.
