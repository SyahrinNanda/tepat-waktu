# Status implementasi

Diperbarui: 5 November 2026 (audit awal 16 Oktober 2026). Acuan awal: 68 screenshot di `Main Feature` dan `PRD-TepatWaktu-Main-Feature.md`.

## Fitur yang dihentikan

Payroll lama (istilah payroll), kasbon, klaim beban, dan laporan keuangan **tidak dilanjutkan** (keputusan 5 November 2026). Tabel, kategori file, dan CSS-nya sudah dibuang lewat migrasi `0034_remove_finance_leftovers`. Penggantinya untuk urusan gaji adalah **Daftar Gaji Karyawan** dan **Slip Gaji** di bawah.

## Sudah tersambung ke data nyata

- **Akun (Better Auth saja):** login email/password, pendaftaran perusahaan dengan verifikasi email, lupa/atur ulang password, sesi, ganti password, role superadmin dan role perusahaan. Penghapusan akun: pengguna mengajukan di `/penghapusan-akun`, mengonfirmasi lewat tautan email (24 jam), lalu superadmin memproses atau menolak di Superadmin → Permintaan Hapus Akun; pemohon menerima email hasilnya. Tidak ada Supabase dan login Google. Detail: `docs/AUTH.md`.
- **Email:** verifikasi akun, reset password, konfirmasi dan hasil penghapusan akun, dan pengingat langganan lewat fallback Mailjet → Mailtrap → Brevo dengan penghitung kuota harian (`lib/mailer.ts`).
- **Presensi:** check-in/out kamera langsung, aman untuk check-in serentak, foto privat di object storage, input oleh admin/superadmin, kehadiran harian, laporan bulanan, riwayat.
- **Pengajuan:** izin/cuti dan lembur dengan persetujuan, laporan cuti.
- **Karyawan:** daftar, detail, user login per role, keluhan karyawan.
- **Gaji:** Daftar Gaji Karyawan (basis gaji, upah lembur, kompensasi, potongan per karyawan) dan Slip Gaji bulanan dari kehadiran, izin/cuti, dan lembur, dengan kunci slip. Aturan hitung: `docs/SLIP-GAJI.md`.
- **Kunjungan:** daftar dan laporan kunjungan.
- **Master data:** jadwal kerja, hari dan waktu kerja, divisi, jabatan, lokasi kerja, pemberitahuan.
- **Langganan:** pembayaran online lewat Midtrans Snap (VA, QRIS, GoPay, ShopeePay, kartu, Indomaret, Alfamart, Akulaku) dengan biaya admin per metode dan aktivasi otomatis lewat webhook; verifikasi manual superadmin tetap ada; batas jumlah karyawan aktif sesuai paket; katalog paket (Free Trial sampai Enterprise) dan paket custom >1000 karyawan; invoice, kupon diskon (termasuk di form pendaftaran), verifikasi manual superadmin; akses diblokir saat paket berakhir; peringatan H-5/H-2 di dashboard dan email ke admin.
- **Superadmin:** kelola perusahaan dan akun, masuk ke tenant, analitik bidang usaha, retensi dan monitor kapasitas, laporan pendapatan (ekspor Excel), konversi trial, kupon, pengumuman platform, log aktivitas, ubah tanggal daftar dan jatuh tempo.
- **Zona waktu:** tanggal operasional perusahaan (hari presensi, laporan, tanggal langganan yang dilihat perusahaan) memakai zona waktu perusahaan (`companies.timezone`). Halaman superadmin memakai WITA sebagai zona waktu platform.
- **Deploy:** `Dockerfile`, `docker-compose.yml` (lokal), dan `docker-compose.prod.yml` untuk VPS + Coolify + Cloudflare R2 (`docs/DEPLOY-VPS-COOLIFY.md`).

## Belum lengkap

- **Pembayaran:** Midtrans baru diuji dengan server tiruan; perlu diuji dengan akun sandbox sungguhan (lihat `docs/DEPLOY-VPS-COOLIFY.md` bagian 4b). Refund/chargeback hanya dicatat, tidak menonaktifkan paket otomatis.
- **Lokasi presensi:** geofence memakai koordinat browser yang bisa dipalsukan. Fitur IP whitelist sudah dihapus (keputusan 6 Nov 2026).
- **Master data:** shift, divisi, jabatan, dan lokasi belum menjadi referensi relasional wajib di semua aturan presensi lintas modul.
- **Gaji:** belum ada perhitungan pajak dan BPJS otomatis, serta proses pembayaran gaji.
- **Cuti:** kuota diasumsikan 12 hari per karyawan; belum ada kebijakan cuti per perusahaan dan kalender hari libur.
- **Pengujian:** belum ada tes E2E otomatis menyeluruh dan tes isolasi tenant; pengiriman email lewat layanan SMTP sungguhan dan deploy VPS belum diuji (lihat `docs/CATATAN-PRIORITAS.md`).
- **Tampilan:** kesetaraan pixel-by-pixel dengan 68 screenshot acuan belum diverifikasi.

Dokumen ini adalah audit status, bukan klaim selesai seluruh PRD.
