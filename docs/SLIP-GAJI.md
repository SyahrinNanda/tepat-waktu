# Slip Gaji: aturan perhitungan

Menu: **Karyawan → Slip Gaji** (Admin, General Manager, HRD).

Slip dihitung per karyawan per bulan dari empat sumber:
- **Daftar Gaji Karyawan**: basis gaji, upah, upah lembur, kompensasi, dan potongan.
- **Kehadiran**: hadir, terlambat, alpa, serta jam check-in dan check-out.
- **Pengajuan Izin/Cuti** yang disetujui, berikut status gajinya (dibayar atau tidak dibayar).
- **Pengajuan Lembur** yang disetujui.

## 1. Basis gaji per karyawan

Diatur di Daftar Gaji, kolom **Basis Gaji**.

| Basis | Upah pokok di slip | Izin/cuti **dibayar** | Izin **tidak dibayar** dan **alpa** |
|---|---|---|---|
| Per Bulan | Gaji pokok penuh | Tidak dipotong | Dipotong **gaji pokok ÷ jumlah hari kerja bulan itu** per hari |
| Per Hari | Upah × hari hadir | Tetap diupah per hari | Tidak diupah (tidak ada baris potongan) |
| Per Jam | Upah × jam kerja nyata | Tetap diupah sebanyak jam kerja terjadwal hari itu | Tidak diupah |

- **Hari kerja** mengikuti Jadwal Kerja divisi karyawan, yaitu hari-hari yang aktif. Kalau divisi belum punya jadwal, dipakai jadwal aktif pertama perusahaan. Kalau perusahaan juga belum punya jadwal, dipakai Senin–Jumat dengan 8 jam per hari.
- **Jam kerja nyata** = check-out − check-in − istirahat. Hari tanpa check-out dihitung 0 jam.

## 2. Izin/cuti dibayar atau tidak dibayar

Setiap pengajuan izin/cuti punya **Status Gaji**:
- Nilai awal mengikuti jenisnya: **Cuti Tahunan** dan **Sakit** dibayar, **Izin** tidak dibayar.
- HRD/Admin bisa memilih **Dibayar** atau **Tidak dibayar** di form pengajuan. Status ini juga bisa diubah kapan saja dengan mengklik label di kolom **Gaji** pada daftar pengajuan. Contoh: izin keluarga yang tetap digaji.
- Karyawan biasa tidak bisa memilih status ini. Pengajuannya selalu memakai nilai awal sesuai jenis.
- Hanya pengajuan berstatus **Disetujui** yang dihitung, dan hanya pada tanggal yang termasuk hari kerja.

## 3. Lembur dan komponen gaji

- **Lembur** = total jam lembur yang disetujui di bulan itu × upah lembur per jam.
- **Kompensasi dan potongan**:
  - Per bulan: dihitung penuh.
  - Per hari: dikalikan **hari hadir** (misalnya uang makan, yang tidak dibayar saat izin).
  - Per jam: dikalikan jam kerja nyata.

## 4. Draft dan terkunci

- **Draft**: angka dihitung ulang setiap kali halaman dibuka, jadi ikut berubah kalau gaji, kehadiran, atau izin diubah.
- **Kunci Slip**: angka dan rinciannya disimpan apa adanya, lalu tidak berubah lagi. Penguncian bisa per karyawan atau sekaligus lewat **Kunci Semua Draft**.
- **Buka Kunci**: snapshot dihapus, dan slip kembali dihitung ulang dari data terbaru.
- **Cetak / PDF**: tampilan cetak tanpa sidebar. Pilih "Save as PDF" di dialog cetak browser.

## Contoh

November 2026 punya 21 hari kerja (Senin–Jumat). Dalam contoh ini karyawan:
- hadir 18 hari,
- sakit 1 hari (dibayar),
- izin 1 hari (tidak dibayar),
- alpa 1 hari,
- lembur 1,5 jam dengan upah lembur Rp25.000/jam,
- mendapat uang makan Rp20.000/hari, dan
- dipotong BPJS Rp100.000/bulan.

| Basis | Upah | Pendapatan | Potongan | Gaji bersih |
|---|---|---|---|---|
| Per Bulan | Rp4.200.000 | 4.200.000 + 37.500 + 360.000 | 200.000 (izin) + 200.000 (alpa) + 100.000 | **Rp4.097.500** |
| Per Hari | Rp150.000 | 2.700.000 + 150.000 (sakit) + 37.500 + 360.000 | 100.000 | **Rp3.147.500** |
| Per Jam | Rp25.000 | 3.600.000 (144 jam) + 200.000 (sakit 8 jam) + 37.500 + 360.000 | 100.000 | **Rp4.097.500** |

## Teknis

- Migrasi `drizzle/0027_payslip_leave_paid.sql` menambah dua kolom dan satu indeks:
  - `leave_requests.paid`. Pengajuan Izin lama otomatis menjadi tidak dibayar.
  - `employee_salary_profiles.salary_basis`, dengan nilai awal `monthly`.
  - Indeks periode pada `payrolls`.
- Slip yang dikunci disimpan di tabel `payrolls` (status `Final`) dan `payroll_items`.
- Rumus perhitungan ada di `features/payslips/server/payslip-calculation.ts` (tanpa akses database). Pengambilan data ada di `payslip-service.ts`.
