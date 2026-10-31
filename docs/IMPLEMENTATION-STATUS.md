# Status implementasi terhadap Main Feature

Tanggal audit: 16 Oktober 2026. Acuan: 68 screenshot di `Main Feature` dan `PRD-TepatWaktu-Main-Feature.md`.

## Sudah tersambung ke data nyata

- Better Auth: login, registrasi, sesi, profil, ganti kata sandi; role superadmin dan role perusahaan.
- PostgreSQL + Drizzle: perusahaan, anggota, karyawan, jadwal, presensi, izin/cuti, modul record, paket, invoice, konfigurasi.
- Presensi: check-in/out kamera langsung, penyimpanan foto privat di object storage, input oleh admin/superadmin, laporan harian/bulanan.
- Modul daftar/detail/form: pengumuman, master data, lembur, kasbon, klaim beban, kunjungan, istilah, pembayaran kasbon, laporan keuangan, IP whitelist. CRUD tersimpan dan dibatasi perusahaan/role.
- Karyawan: daftar dan detail, user login per role, profil gaji per karyawan, laporan cuti dari pengajuan nyata.
- Payroll: input komponen draft dan preferensi payroll tersimpan.
- Langganan: 12 paket tersimpan, pengajuan invoice per perusahaan, verifikasi manual superadmin, paket aktif diperbarui setelah disetujui.
- Pengaturan: profil akun, identitas perusahaan, identitas platform, paket/harga.
- Superadmin: memilih tenant setelah login, masuk ke dashboard tenant dengan tampilan dan hak Admin, mengganti tenant, mengelola seluruh akun tenant, serta kembali ke pengaturan paket/langganan platform.
- Tampilan: dasar sidebar, header, tabel, drawer form, paket grid, dan login diselaraskan dengan pola screenshot tanpa menyalin logo/identitas merek sumber.

## Belum setara penuh dengan PRD atau screenshot

- Beberapa layout dan interaksi detail dari 68 screenshot belum diuji pixel-by-pixel; kesetaraan visual penuh belum terverifikasi.
- Record master shift/jam kerja/divisi/jabatan/lokasi belum menjadi referensi relasional wajib pada karyawan, jadwal, dan validasi presensi. Data tersimpan tetapi aturan bisnis lintas-modul belum lengkap.
- IP whitelist baru berupa konfigurasi tersimpan; belum membatasi akses, agar presensi tidak terblokir tanpa kebijakan yang jelas.
- Kasbon, klaim beban, kunjungan, istilah dan laporan keuangan memakai record tenant-scoped; perhitungan saldo/cicilan, alur bukti berlapis, dan agregasi laporan belum lengkap.
- Profil gaji tidak otomatis menjadi payroll. Preferensi payroll tidak otomatis diterapkan; pajak, BPJS, slip final, dan proses pembayaran gaji belum tersedia.
- Paket belum membatasi jumlah karyawan atau akses fitur secara otomatis. Tidak ada gateway pembayaran/webhook; verifikasi paket berbayar bersifat manual dan tidak membuktikan transfer melalui aplikasi.
- Kuota laporan cuti saat ini diasumsikan 12 hari kalender per karyawan; belum ada kebijakan cuti per perusahaan dan kalender hari kerja/libur.
- Belum ada audit log perubahan umum, tes E2E lengkap, dan tes isolasi tenant menyeluruh.

## Verifikasi yang dijalankan

- `npm run db:generate`, `npm run db:migrate`, `npm run db:seed`: berhasil.
- `npm run build`, `npm run lint`: berhasil.
- Login admin/superadmin, halaman utama tiap peran, API CRUD record, dan penolakan 403 untuk karyawan pada master shift: berhasil.
- Akun demo dapat dicek ulang dengan `npm run accounts:demo`.

Dokumen ini adalah audit status, bukan klaim selesai seluruh PRD.
