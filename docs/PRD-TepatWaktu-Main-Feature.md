# Product Requirements Document — TepatWaktu Main Feature

| Informasi | Nilai |
|---|---|
| Produk | TepatWaktu — Sistem Presensi dan HRIS Multi-Perusahaan |
| Dokumen | Product Requirements Document (PRD) |
| Versi | 1.0 |
| Status | Draft untuk validasi produk |
| Tanggal | 16 Oktober 2026 |
| Sumber utama | 68 screenshot dalam folder `Main Feature` |
| Stack saat ini | Next.js 16.2.9, React 19, PostgreSQL, Drizzle ORM, Better Auth |

## 1. Ringkasan Eksekutif

TepatWaktu akan dikembangkan dari aplikasi presensi dasar menjadi platform HRIS multi-perusahaan yang mencakup pengelolaan karyawan, master data organisasi, presensi berbasis lokasi, kunjungan, pengajuan karyawan, payroll, kasbon, laporan perusahaan, langganan, dan kontrol akses.

Versi aplikasi saat ini sudah menyediakan autentikasi, perusahaan, karyawan dasar, jadwal kerja, presensi manual, pengajuan izin/cuti, dashboard, dan laporan sederhana. Namun, sebagian besar alur yang tampak pada referensi belum tersedia atau masih terlalu sederhana.

PRD ini mendefinisikan kebutuhan untuk mencapai kesetaraan fungsi dengan screenshot referensi. Dokumen ini tidak mengharuskan penyalinan identitas visual, logo, teks merek, atau aset milik produk referensi. TepatWaktu tetap menggunakan identitas produknya sendiri.

## 2. Dasar dan Klasifikasi Requirement

Requirement menggunakan tiga klasifikasi:

- **Teramati**: fungsi atau data terlihat langsung pada screenshot.
- **Keputusan desain**: rancangan TepatWaktu agar fungsi dapat diterapkan secara aman dan konsisten.
- **Belum ditentukan**: membutuhkan keputusan produk atau integrasi sebelum implementasi.

Inventaris screenshot:

| Kelompok | Jumlah | Area produk |
|---|---:|---|
| First Feature | 4 | Dashboard, monitor, pengumuman |
| LoginRegister | 6 | Login, onboarding, paket, verifikasi email |
| Master Data | 11 | Shift, jam kerja, divisi, jabatan, lokasi, istilah gaji |
| Karyawan | 5 | Daftar karyawan, profil, gaji, laporan cuti |
| Pengajuan Karyawan | 8 | Izin/cuti, lembur, kasbon, klaim beban |
| Presensi | 4 | Presensi harian dan laporan bulanan |
| Kunjungan | 3 | Penjadwalan dan laporan kunjungan |
| Payroll | 5 | Istilah gaji, daftar payroll, input, pengaturan |
| Pembayaran Kasbon | 1 | Daftar pembayaran dan slip kasbon |
| Perusahaan | 4 | Laporan dan istilah keuangan |
| Langganan | 8 | Paket, upgrade, invoice, pembayaran |
| Pengaturan | 9 | Profil, konfigurasi, user, level akses, IP whitelist |
| **Total** | **68** | |

Modul Inventaris, Pengajuan Inventaris, dan Tugas Premium terlihat pada navigasi, tetapi tidak memiliki bukti layar yang cukup. Modul tersebut berada di luar scope rilis ini sampai tersedia requirement tambahan.

## 3. Masalah Produk

### 3.1 Masalah pengguna perusahaan

- Data karyawan belum cukup lengkap untuk administrasi HR.
- Struktur divisi, jabatan, shift, dan lokasi masih berupa data bebas atau belum tersedia.
- Presensi belum divalidasi terhadap shift dan lokasi.
- Pengajuan karyawan belum mencakup lembur, kasbon, dan klaim beban.
- Payroll belum dapat dihitung dari komponen gaji dan aktivitas presensi.
- Hak akses belum dapat dikonfigurasi per halaman, divisi, dan aksi.
- Paket langganan belum benar-benar membatasi fitur dan jumlah karyawan.

### 3.2 Masalah administrator aplikasi

- Sulit memastikan isolasi data antarperusahaan bila modul baru ditambahkan tanpa pola tenant yang konsisten.
- Proses penting belum memiliki audit trail.
- Belum ada sumber data terpusat untuk tagihan, pembayaran, dan penggunaan paket.
- Belum ada fondasi file privat untuk KTP, dokumen karyawan, bukti klaim, dan slip gaji.

## 4. Visi Produk

TepatWaktu menjadi pusat operasional HR perusahaan yang memungkinkan administrator mengelola karyawan, presensi, pengajuan, kunjungan, payroll, dan langganan dalam satu aplikasi yang aman, mudah diaudit, dan mendukung banyak perusahaan.

## 5. Tujuan

### 5.1 Tujuan utama

1. Menyediakan alur lengkap dari onboarding perusahaan sampai operasional HR harian.
2. Menjadikan data master sebagai sumber kebenaran untuk presensi dan payroll.
3. Memungkinkan pengajuan dan persetujuan yang dapat dilacak.
4. Menghasilkan payroll yang konsisten dan dapat diaudit.
5. Menyediakan kontrol akses multi-perusahaan yang aman.
6. Mendukung monetisasi melalui paket, invoice, dan pembayaran.

### 5.2 Indikator keberhasilan

- 100% query bisnis terikat pada perusahaan aktif.
- Tidak ada akses silang data antarperusahaan pada pengujian keamanan.
- Administrator dapat menambah karyawan dan mencatat presensi tanpa intervensi teknis.
- Payroll satu periode dapat dihitung ulang secara deterministik.
- Seluruh perubahan status pengajuan memiliki riwayat aktor dan waktu.
- Webhook pembayaran dapat diproses berulang tanpa membuat pembayaran ganda.
- Waktu muat halaman daftar utama maksimal 2,5 detik pada data operasional normal.

## 6. Non-Goals

Rilis ini tidak mencakup:

- Aplikasi mobile native.
- Face recognition, kecuali disepakati dalam keputusan produk lanjutan.
- Akuntansi penuh seperti buku besar, jurnal, dan rekonsiliasi bank.
- Pelaporan pajak resmi otomatis.
- Inventaris dan tugas premium tanpa screenshot atau requirement tambahan.
- Penyalinan merek, logo, atau aset produk referensi.

## 7. Persona dan Hak Akses Dasar

| Persona | Kebutuhan utama |
|---|---|
| Super Admin | Mengelola seluruh perusahaan, paket, harga, langganan, konfigurasi global, dan kesehatan platform |
| Admin Perusahaan | Administrator penuh untuk tepat satu perusahaan yang dibuat atau ditugaskan kepadanya |
| General Manager | Melihat seluruh operasional perusahaan, laporan, dan persetujuan tanpa konfigurasi platform |
| HRD | Mengelola master data, karyawan, presensi, cuti, lembur, dan payroll perusahaan |
| Manager | Melihat data tim/divisi serta menyetujui pengajuan sesuai kewenangan |
| Karyawan / Staf | Melakukan presensi dan mengakses data serta pengajuan miliknya sendiri |

`superadmin` merupakan role platform global dan tidak berasal dari proses pendaftaran perusahaan. Pengguna yang mendaftarkan perusahaan otomatis menjadi `admin` hanya pada perusahaan tersebut. Role `general_manager`, `hrd`, `manager`, dan `employee` berada pada membership perusahaan serta selalu dibatasi oleh tenant dan permission server-side.

## 8. Arsitektur Informasi

```text
Dashboard
├── Ringkasan
├── Monitor Perusahaan
└── Pengumuman

Master Data
├── Shift
├── Jam Kerja
├── Divisi
├── Jabatan
├── Lokasi Presensi
├── Lokasi Kunjungan
└── Istilah Gaji

Karyawan
├── Daftar Karyawan
├── Tambah/Edit Karyawan
├── Daftar Gaji Karyawan
└── Laporan Cuti

Pengajuan Karyawan
├── Izin/Cuti
├── Lembur
├── Kasbon
└── Klaim Beban

Presensi
├── Presensi Harian
└── Laporan Presensi Bulanan

Kunjungan
├── Daftar Kunjungan
└── Laporan Kunjungan

Payroll
├── Istilah Gaji
├── Daftar Payroll
└── Pengaturan Payroll

Perusahaan
├── Laporan Keuangan
└── Istilah Keuangan

Kasbon
└── Pembayaran Kasbon

Langganan
├── Ringkasan Langganan
├── Daftar Paket
└── Invoice dan Pembayaran

Pengaturan
├── Profil
├── Pengaturan Aplikasi
├── User Login
├── User Level
└── IP Whitelist
```

## 9. Functional Requirements

### 9.1 Autentikasi dan Onboarding

#### AUTH-01 — Login

**Klasifikasi:** Teramati

- Pengguna dapat login menggunakan email dan password.
- Sistem menampilkan pesan yang jelas ketika kredensial tidak valid.
- Pengguna yang belum memverifikasi email diarahkan ke proses verifikasi.
- Setelah login, pengguna diarahkan ke perusahaan aktif atau pemilihan perusahaan.

#### AUTH-02 — Registrasi bertahap

**Klasifikasi:** Teramati

- Tahap akun: nama, email, password, dan konfirmasi password.
- Tahap perusahaan: nama dan bidang usaha.
- Pilihan bidang usaha minimal mencakup Teknologi, Pemerintahan, F&B, Jasa, Media, dan Lainnya.
- Tahap paket: pengguna memilih paket yang tersedia.
- Sistem membuat akun, perusahaan, membership owner, dan langganan awal secara atomik.

#### AUTH-03 — Verifikasi email

**Klasifikasi:** Teramati

- Sistem mengirim tautan verifikasi dengan masa berlaku.
- Tautan hanya dapat digunakan sesuai aturan token.
- Sistem menyediakan halaman sukses, kedaluwarsa, dan gagal.
- Pengiriman ulang memiliki rate limit.

#### AUTH-04 — Pemulihan akun

**Klasifikasi:** Keputusan desain

- Pengguna dapat meminta reset password.
- Respons tidak boleh membocorkan apakah suatu email terdaftar.
- Semua sesi lama dapat dicabut setelah password diubah.

### 9.2 Dashboard, Monitor, dan Pengumuman

#### DASH-01 — Ringkasan dashboard

**Klasifikasi:** Teramati

- Menampilkan sapaan yang dapat dikonfigurasi.
- Menampilkan jumlah karyawan aktif, lokasi presensi, pengumuman aktif, dan status langganan.
- Menampilkan aktivitas presensi terbaru dan pengajuan yang menunggu.

#### DASH-02 — Monitor perusahaan

**Klasifikasi:** Teramati

- Filter bulan dan tahun.
- Ringkasan total karyawan, tepat waktu, terlambat, dan izin.
- Grafik atau daftar lima karyawan paling sering terlambat.
- Grafik atau daftar lima karyawan paling tepat waktu.
- Penggunaan limit karyawan berdasarkan paket.
- Perbandingan demografi yang tersedia, termasuk jenis kelamin.

#### ANN-01 — Pengumuman

**Klasifikasi:** Teramati

- Daftar pengumuman memiliki pencarian, status, pagination, edit, dan hapus.
- Administrator dapat mengunggah gambar.
- Form berisi judul, deskripsi singkat, dan isi rich text.
- Pengumuman memiliki status draft/published/archived dan periode tayang.

### 9.3 Master Data

#### MASTER-01 — Shift

**Klasifikasi:** Teramati

- CRUD shift.
- Field minimal: nama shift, toleransi terlambat dalam menit, dan status aktif.
- Shift yang sudah digunakan tidak boleh dihapus secara permanen; gunakan status nonaktif.

#### MASTER-02 — Jam kerja

**Klasifikasi:** Teramati

- Jam kerja diatur per shift dan hari Senin–Minggu.
- Setiap hari dapat ditandai sebagai hari kerja/libur.
- Field hari kerja: jam masuk dan jam pulang.
- Validasi mencegah periode jam yang tidak sah.

#### MASTER-03 — Divisi

**Klasifikasi:** Teramati

- CRUD divisi.
- Divisi memiliki shift default.
- Metode perhitungan gaji: per jam, per hari, atau per bulan.
- Divisi dapat dinonaktifkan tanpa menghapus histori karyawan.

#### MASTER-04 — Jabatan

**Klasifikasi:** Teramati

- CRUD jabatan.
- Jabatan dapat digunakan lintas divisi atau dibatasi sesuai keputusan produk.

#### MASTER-05 — Lokasi presensi

**Klasifikasi:** Teramati

- CRUD lokasi dengan nama, alamat, latitude, longitude, dan radius meter.
- Peta mendukung memilih dan memindahkan pin.
- Lokasi dapat diterapkan ke semua atau karyawan tertentu.
- Validasi radius dilakukan kembali pada server saat presensi dikirim.

#### MASTER-06 — Lokasi kunjungan

**Klasifikasi:** Teramati

- Field minimal: nama lokasi, nama pemilik, email, nomor telepon, alamat, koordinat, dan radius.
- Lokasi dapat diterapkan ke semua atau karyawan tertentu.

#### MASTER-07 — Istilah gaji

**Klasifikasi:** Teramati

- CRUD istilah gaji.
- Tipe istilah minimal: pendapatan/kompensasi dan potongan.
- Istilah gaji digunakan oleh konfigurasi gaji karyawan dan item payroll.
- Menu Master Data dan Payroll mengarah ke sumber data istilah yang sama.

### 9.4 Karyawan

#### EMP-01 — Daftar karyawan

**Klasifikasi:** Teramati

- Pencarian nama, email, atau nomor induk.
- Filter divisi, jabatan, status, dan lokasi presensi.
- Kolom minimal: foto, nama, jabatan/divisi, lokasi presensi, dan status.
- Aksi: lihat, edit, nonaktifkan, dan atur gaji.
- Pagination dan jumlah baris per halaman.

#### EMP-02 — Profil karyawan

**Klasifikasi:** Teramati

- Upload foto profil, foto selfie, KTP, ijazah, dan sertifikat.
- Field minimal: nama, nomor induk opsional, email, nomor HP, alamat, tanggal lahir, jenis kelamin, tanggal mulai kerja, divisi, jabatan, lokasi presensi, NPWP, dan BPJS.
- File sensitif bersifat privat dan hanya diakses melalui URL sementara.
- Email dan nomor induk unik di dalam perusahaan, bukan secara global.

#### EMP-03 — Gaji karyawan

**Klasifikasi:** Teramati

- Mengatur upah lembur per jam dan upah/gaji dasar.
- Mendukung kompensasi dan potongan berulang.
- Mendukung batch edit berdasarkan divisi atau pilihan karyawan.
- Komponen menyimpan tanggal efektif agar payroll historis tidak berubah.

#### EMP-04 — Laporan cuti

**Klasifikasi:** Teramati

- Menampilkan hak cuti, cuti terpakai, cuti menunggu, dan sisa cuti.
- Filter karyawan, divisi, dan periode.
- Data terhubung ke kebijakan serta pengajuan cuti yang disetujui.

### 9.5 Pengajuan Karyawan

Semua tipe pengajuan harus memiliki pencarian, filter periode/status, ekspor Excel, detail, histori persetujuan, dan bulk approve/reject jika pengguna memiliki izin.

Status dasar:

```text
draft → pending → approved | rejected → processed
```

#### REQ-01 — Izin dan cuti

**Klasifikasi:** Teramati dan perluasan dari fitur saat ini

- Tipe minimal: cuti tahunan, sakit, dan izin.
- Field: karyawan, tanggal mulai/selesai, alasan, dan lampiran opsional.
- Sistem memvalidasi saldo cuti dan benturan tanggal.
- Saldo baru dikurangi sesuai kebijakan saat pengajuan disetujui.

#### REQ-02 — Lembur

**Klasifikasi:** Teramati

- Field: karyawan, tanggal, jam, menit, dan deskripsi.
- Durasi lembur disimpan dalam menit.
- Pengajuan yang disetujui dapat menjadi komponen payroll.

#### REQ-03 — Kasbon

**Klasifikasi:** Teramati

- Field: karyawan, tanggal, nominal, tenor, dan deskripsi.
- Sistem menghitung estimasi cicilan per bulan.
- Kasbon yang disetujui menghasilkan akun pinjaman dan jadwal cicilan.

#### REQ-04 — Klaim beban

**Klasifikasi:** Teramati

- Field: karyawan, tanggal, nominal, deskripsi, catatan opsional, dan foto bukti.
- Klaim yang disetujui dapat dibayarkan melalui payroll atau pembayaran terpisah.

#### REQ-05 — Approval event

**Klasifikasi:** Keputusan desain

- Setiap keputusan mencatat aktor, waktu, status sebelum/sesudah, dan catatan.
- Keputusan tidak boleh menghapus histori sebelumnya.
- Sistem menolak approval oleh pengguna tanpa hak atas divisi terkait.

### 9.6 Presensi

#### ATT-01 — Presensi harian

**Klasifikasi:** Teramati

- Filter tanggal, karyawan, divisi, shift, dan status.
- Kolom minimal: karyawan, jadwal, jam masuk, jam pulang, keterlambatan, dan status.
- Administrator dapat menambahkan atau mengoreksi presensi dengan alasan.
- Koreksi dicatat dalam audit log.

#### ATT-02 — Validasi presensi

**Klasifikasi:** Keputusan desain berdasarkan lokasi dan shift yang teramati

- Sistem menentukan jadwal efektif karyawan.
- Status tepat waktu/terlambat dihitung menggunakan toleransi shift.
- Jika lokasi diwajibkan, sistem memvalidasi koordinat dan radius.
- Sistem menyimpan koordinat, akurasi, jarak, waktu server, perangkat, dan sumber pencatatan.

#### ATT-03 — Foto langsung check-in dan check-out

**Klasifikasi:** Keputusan produk

- Check-in dan check-out wajib menggunakan foto yang diambil saat itu melalui kamera perangkat.
- UI tidak menyediakan input file atau pilihan foto dari galeri.
- Kamera hanya dibuka setelah tindakan eksplisit pengguna dan media stream dihentikan setelah foto diambil, modal ditutup, atau halaman ditinggalkan.
- Pengguna melihat pratinjau foto dan dapat mengambil ulang sebelum konfirmasi.
- Server menyimpan waktu server sebagai sumber waktu utama; waktu perangkat hanya menjadi metadata pendukung.
- Foto check-in dan check-out disimpan sebagai aset privat yang berbeda, terikat pada record presensi, dan tidak menggunakan URL publik permanen.
- Metadata minimal: waktu server, jenis aksi, perangkat, koordinat, akurasi, IP secara terbatas, dan hasil validasi lokasi.
- Foto kamera merupakan bukti kehadiran, bukan face recognition. Pengenalan wajah memerlukan keputusan dan persetujuan privasi terpisah.

#### ATT-04 — Pengingat presensi

**Klasifikasi:** Keputusan produk

- Web menampilkan notice yang terlihat jelas ketika pengguna belum check-in setelah awal jadwal atau belum check-out setelah akhir jadwal.
- Notice menyediakan satu tombol langsung menuju kamera agar pengingat tidak menambah langkah yang tidak perlu.
- Pengingat tidak menghalangi akses ke halaman lain dan dibedakan secara visual dari error sistem.
- Status diperbarui segera setelah presensi sukses dan notice tidak lagi ditampilkan untuk aksi yang sudah selesai.
- Server mencegah presensi ganda secara idempotent per karyawan, tanggal, dan jenis aksi.

#### ATT-05 — Laporan bulanan

**Klasifikasi:** Teramati

- Filter bulan, tahun, divisi, shift, status, dan karyawan.
- Ringkasan hadir, tepat waktu, terlambat, izin, sakit, cuti, dan absen.
- Mendukung pagination, ekspor Excel, dan tampilan detail harian.

### 9.7 Kunjungan

#### VISIT-01 — Daftar kunjungan

**Klasifikasi:** Teramati

- Administrator dapat menjadwalkan kunjungan untuk karyawan dan tanggal tertentu.
- Kunjungan terkait ke lokasi kunjungan master.
- Daftar memiliki pencarian, filter periode, status, dan pagination.

#### VISIT-02 — Check-in kunjungan

**Klasifikasi:** Keputusan desain

- Menyimpan waktu, koordinat, jarak dari lokasi, foto opsional, dan catatan.
- Status minimal: scheduled, checked-in, completed, missed, cancelled.

#### VISIT-03 — Laporan kunjungan

**Klasifikasi:** Teramati

- Filter karyawan, lokasi, tanggal, dan status.
- Mendukung ekspor Excel.
- Menampilkan waktu masuk/keluar dan durasi kunjungan bila tersedia.

### 9.8 Payroll

#### PAY-01 — Pengaturan payroll

**Klasifikasi:** Teramati

- Catatan default payroll.
- Toggle perhitungan cuti.
- Toggle perhitungan lembur.
- Toggle tampilan rincian kompensasi dan potongan.
- Pengaturan berlaku per perusahaan.

#### PAY-02 — Proses payroll

**Klasifikasi:** Teramati dan keputusan desain

- Payroll dibuat berdasarkan bulan dan tahun.
- Pengguna dapat memilih satu, beberapa, atau seluruh karyawan aktif.
- Payroll menarik snapshot gaji pokok, komponen, presensi, lembur, cuti, klaim, dan kasbon.
- Status: draft, calculated, finalized, paid, cancelled.
- Finalisasi menggunakan database transaction.
- Payroll final tidak dapat diubah; koreksi dilakukan melalui pembatalan terkendali atau adjustment.

#### PAY-03 — Input dan upload slip

**Klasifikasi:** Teramati

- Pengguna dapat menginput komponen secara manual.
- Form mendukung jumlah, tipe gaji, nominal per unit, dan total.
- Sistem dapat menerima upload slip atau dokumen pendukung sesuai format yang ditentukan.

#### PAY-04 — Slip gaji

**Klasifikasi:** Keputusan desain

- Slip memuat identitas perusahaan/karyawan, periode, pendapatan, potongan, total bersih, dan catatan.
- Slip dapat dilihat dan diunduh sebagai PDF.
- Hanya user berizin dan karyawan pemilik slip yang boleh mengakses.

### 9.9 Kasbon dan Pembayaran

#### LOAN-01 — Jadwal cicilan

**Klasifikasi:** Teramati dan keputusan desain

- Kasbon yang disetujui membuat jadwal cicilan berdasarkan tenor.
- Cicilan dapat dipotong melalui payroll atau dibayar manual.
- Sistem menghitung saldo pokok tersisa.

#### LOAN-02 — Pembayaran kasbon

**Klasifikasi:** Teramati

- Daftar pembayaran dapat difilter berdasarkan karyawan dan periode.
- Administrator dapat mencatat pembayaran manual.
- Sistem mencegah pembayaran melebihi saldo tanpa override berizin.
- Bukti/slip pembayaran dapat dicetak atau diunduh.

### 9.10 Perusahaan dan Keuangan

#### FIN-01 — Istilah keuangan

**Klasifikasi:** Teramati

- CRUD istilah keuangan.
- Tipe minimal: pemasukan dan pengeluaran.
- Istilah nonaktif tetap dipertahankan pada laporan historis.

#### FIN-02 — Laporan keuangan

**Klasifikasi:** Teramati

- Administrator dapat menambah entri laporan berdasarkan istilah keuangan.
- Daftar memiliki filter periode, tipe, pencarian, dan pagination.
- Nominal disimpan sebagai nilai integer/decimal yang aman, bukan floating point.
- Modul ini merupakan laporan operasional sederhana, bukan sistem akuntansi penuh.

### 9.11 Langganan dan Billing

#### SUB-01 — Katalog paket

**Klasifikasi:** Teramati

- Menampilkan nama paket, harga per bulan, limit karyawan, dan fitur.
- Paket dapat memiliki versi harga dan periode efektif.
- Paket gratis dan berbayar didukung.

#### SUB-02 — Ringkasan langganan

**Klasifikasi:** Teramati

- Menampilkan paket aktif, masa berlaku, penggunaan kuota, dan rekomendasi upgrade.
- Menampilkan riwayat invoice dan status pembayaran.
- Mendukung berhenti berlangganan sesuai aturan produk.

#### SUB-03 — Upgrade/downgrade

**Klasifikasi:** Teramati dan keputusan desain

- Pengguna melihat ringkasan perubahan harga sebelum konfirmasi.
- Downgrade ditolak atau dijadwalkan jika penggunaan saat ini melebihi limit paket baru.
- Aturan prorata harus ditentukan sebelum implementasi produksi.

#### SUB-04 — Invoice dan pembayaran

**Klasifikasi:** Teramati

- Invoice memiliki nomor unik, paket, periode, subtotal, potongan, biaya admin, total, dan status.
- Status minimal: pending, paid, failed, expired, cancelled, refunded.
- Pengguna dapat memilih metode pembayaran dan melihat hasil pembayaran.
- Invoice dapat diunduh.

#### SUB-05 — Webhook pembayaran

**Klasifikasi:** Keputusan desain

- Webhook diterima melalui Next.js Route Handler.
- Signature provider wajib diverifikasi.
- Event ID provider disimpan secara unik agar proses idempotent.
- Aktivasi paket dan pencatatan pembayaran dilakukan dalam transaction.

#### SUB-06 — Enforcement paket

**Klasifikasi:** Keputusan desain

- Limit karyawan dan akses fitur diperiksa pada server.
- Menu dapat disembunyikan untuk pengalaman pengguna, tetapi bukan satu-satunya kontrol keamanan.
- Percobaan melampaui limit menghasilkan pesan dan jalur upgrade yang jelas.

### 9.12 Pengaturan

#### SET-01 — Profil

**Klasifikasi:** Teramati

- Pengguna dapat melihat/mengubah nama, avatar, dan data profil yang diizinkan.
- Pengguna dapat mengganti password.
- Halaman menampilkan status paket perusahaan jika pengguna berhak melihatnya.

#### SET-02 — Pengaturan aplikasi

**Klasifikasi:** Teramati

- Kalimat sapaan mendukung token nama karyawan.
- Kutipan atau pesan motivasi dapat dikonfigurasi.
- Perusahaan dapat mengaktifkan atau menonaktifkan menu tertentu.
- Aktivasi verifikasi akses tersedia sebagai toggle.

#### SET-03 — User login

**Klasifikasi:** Teramati

- Daftar user menampilkan nama, email, level, tanggal login terakhir, status, dan OTP/2FA bila digunakan.
- Owner/Admin dapat mengundang user baru.
- User dapat dinonaktifkan dan sesi aktifnya dicabut.

#### SET-04 — User level dan permission

**Klasifikasi:** Teramati

- CRUD level user.
- Permission dapat dibatasi berdasarkan halaman, divisi, dan aksi.
- Aksi minimal: read, create, update, delete, approve, export, dan manage.
- Perubahan permission berlaku pada pemeriksaan server berikutnya.

#### SET-05 — IP whitelist

**Klasifikasi:** Teramati

- Administrator dapat menambah dan menghapus alamat/range IP.
- Mode whitelist dapat dinonaktifkan agar tidak mengunci seluruh pengguna secara tidak sengaja.
- Sistem menyimpan siapa yang mengubah aturan dan kapan.
- Mekanisme recovery owner harus tersedia.

## 10. Pola Daftar dan Form

Seluruh halaman daftar mengikuti standar berikut:

- Pencarian dengan debounce.
- Filter dapat direset.
- Pagination server-side.
- Sort pada kolom yang relevan.
- Empty state, loading state, dan error state.
- Aksi sensitif memiliki konfirmasi.
- Ekspor hanya memuat data yang boleh diakses pengguna.
- Filter dan halaman tercermin pada URL agar dapat dibagikan atau dipulihkan.

Seluruh form mengikuti standar berikut:

- Validasi client untuk pengalaman pengguna dan validasi server sebagai otoritas.
- Pesan kesalahan spesifik pada field.
- Tombol submit tidak dapat diklik berulang selama proses.
- Nilai uang disimpan dalam satuan terkecil atau tipe decimal, bukan JavaScript floating point.
- Tanggal dan waktu disimpan konsisten dan ditampilkan memakai zona waktu perusahaan.

## 11. Model Data Tingkat Tinggi

### 11.1 Tabel yang dipertahankan dan diperluas

- `user`, `session`, `account`, `verification`
- `companies`
- `company_members`
- `employees`
- `work_schedules`
- `attendances`
- `leave_requests`

### 11.2 Tabel baru yang direkomendasikan

#### Akses dan konfigurasi

- `invitations`
- `roles`
- `permissions`
- `role_permissions`
- `member_roles`
- `application_settings`
- `ip_whitelists`
- `audit_logs`
- `notifications`

#### Organisasi dan karyawan

- `departments`
- `positions`
- `shifts`
- `shift_workdays`
- `employee_documents`
- `attendance_locations`
- `employee_attendance_locations`
- `visit_locations`
- `employee_visit_locations`
- `leave_policies`
- `leave_balances`

#### Pengajuan dan aktivitas

- `overtime_requests`
- `loan_requests`
- `expense_claims`
- `claim_attachments`
- `approval_events`
- `visits`
- `visit_events`

#### Payroll dan keuangan

- `salary_terms`
- `employee_salary_components`
- `payroll_settings`
- `payroll_runs`
- `payroll_items`
- `payroll_item_components`
- `payslips`
- `employee_loans`
- `loan_installments`
- `loan_payments`
- `finance_terms`
- `finance_entries`

#### Pengumuman, file, dan billing

- `announcements`
- `file_assets`
- `plans`
- `plan_features`
- `subscriptions`
- `subscription_usage`
- `invoices`
- `payments`
- `payment_webhook_events`

### 11.3 Aturan tenant

- Setiap tabel bisnis memiliki `company_id` atau dapat ditelusuri secara pasti ke perusahaan.
- Unique constraint yang bersifat lokal perusahaan harus menyertakan `company_id`.
- Semua mutasi membaca perusahaan aktif dari sesi tepercaya, bukan dari input form saja.
- Akses terhadap record harus memverifikasi membership dan permission.

## 12. API dan Pola Implementasi

### 12.1 Server Actions

Digunakan untuk mutasi yang berasal dari UI TepatWaktu, seperti:

- CRUD master data.
- Menambah atau memperbarui karyawan.
- Persetujuan pengajuan.
- Input dan finalisasi payroll.

Setelah mutasi, halaman terkait diperbarui menggunakan `revalidatePath`, `revalidateTag`, atau `refresh` sesuai kebutuhan.

### 12.2 Route Handlers

Digunakan untuk:

- Better Auth handler.
- Webhook payment gateway.
- Endpoint upload bertanda tangan.
- Download file privat dan ekspor.
- API untuk aplikasi mobile bila ditambahkan kemudian.

### 12.3 Transaction

Transaction wajib digunakan untuk:

- Membuat akun, perusahaan, membership, dan langganan awal.
- Menyetujui cuti dan memperbarui saldo.
- Menyetujui kasbon serta membuat cicilan.
- Finalisasi payroll.
- Pembayaran kasbon.
- Memproses webhook pembayaran dan mengaktifkan langganan.

## 13. Integrasi Eksternal

| Integrasi | Kegunaan | Status keputusan |
|---|---|---|
| Map provider | Pilih pin, geocoding, tampilan lokasi | Belum ditentukan |
| Object storage | Foto, KTP, dokumen, klaim, slip | S3-compatible adapter; development lokal memakai storage di `D:\mini-data\tepatwaktu`, provider produksi dapat diganti lewat environment variable |
| Email provider | Verifikasi, reset password, undangan | Belum ditentukan |
| Payment gateway | Invoice dan pembayaran paket | Belum ditentukan |
| PDF generator | Slip gaji, invoice, slip kasbon | Belum ditentukan |
| Excel export | Laporan operasional | Perlu dipilih |

## 14. Non-Functional Requirements

### 14.1 Keamanan

- Seluruh otorisasi dilakukan di server.
- File sensitif tidak boleh disimpan sebagai URL publik permanen.
- Password dan token dikelola melalui Better Auth.
- Endpoint sensitif memiliki rate limit.
- Webhook memverifikasi signature.
- Audit log bersifat append-only untuk kejadian penting.
- Validasi input menggunakan schema yang dibagikan bila memungkinkan.

### 14.2 Performa

- Daftar besar menggunakan pagination server-side.
- Query memiliki indeks berdasarkan `company_id`, tanggal, status, dan foreign key utama.
- Dashboard menggunakan query agregasi yang dibatasi periode.
- Ekspor besar diproses sebagai job asynchronous bila melebihi batas sinkron.

### 14.3 Reliabilitas

- Operasi keuangan bersifat idempotent.
- Payroll final menyimpan snapshot komponen dan formula.
- Soft delete/nonaktif digunakan untuk data master yang sudah memiliki histori.
- Backup dan restore PostgreSQL harus diuji sebelum produksi.

### 14.4 Aksesibilitas dan responsivitas

- Navigasi dapat digunakan dengan keyboard.
- Modal/drawer memiliki focus trap dan dapat ditutup secara aman.
- Kontras warna memenuhi standar aksesibilitas dasar.
- Desktop menjadi target utama admin panel; tablet tetap didukung.
- Mobile web mendukung operasi ringan, tetapi bukan pengganti aplikasi mobile penuh.

### 14.5 Lokalisasi

- Antarmuka awal menggunakan Bahasa Indonesia.
- Mata uang default IDR.
- Zona waktu default `Asia/Makassar`, tetapi dapat diatur per perusahaan.
- Format tanggal mengikuti locale Indonesia.

## 15. Audit dan Event Penting

Event berikut wajib dicatat:

- Login gagal berulang dan perubahan password.
- Undangan, aktivasi, penonaktifan, dan perubahan role user.
- Perubahan data karyawan sensitif.
- Koreksi presensi.
- Keputusan pengajuan.
- Pembuatan, finalisasi, pembatalan, dan pembayaran payroll.
- Perubahan kasbon dan pembayaran cicilan.
- Perubahan paket dan status invoice.
- Perubahan IP whitelist.

Setiap audit event minimal memiliki perusahaan, aktor, aksi, tipe resource, ID resource, waktu, dan metadata perubahan yang aman.

## 16. Analytics Produk

Event produk yang direkomendasikan:

- `company_onboarding_completed`
- `employee_created`
- `attendance_recorded`
- `request_submitted`
- `request_approved`
- `payroll_finalized`
- `invoice_created`
- `payment_completed`
- `plan_limit_reached`
- `subscription_upgraded`

Data analytics tidak boleh berisi KTP, NPWP, BPJS, password, token, atau bukti dokumen.

## 17. Tahapan Implementasi

### Fase 0 — Fondasi, keamanan, dan design system

- Tetapkan sumber data perusahaan dan membership.
- Terapkan role, permission, audit log, serta tenant guard.
- Bangun komponen table, filter, pagination, modal, drawer, upload, dan konfirmasi.
- Siapkan layanan file privat dan notifikasi.
- Normalisasi migration serta seed development.

**Exit criteria:** tenant isolation dan permission lulus automated test.

### Fase 1 — Master data dan karyawan

- Shift dan jam kerja.
- Divisi dan jabatan.
- Lokasi presensi/kunjungan.
- Istilah gaji.
- Profil dan dokumen karyawan.
- Gaji karyawan dan laporan cuti.

**Exit criteria:** karyawan lengkap dapat dibuat dan memiliki jadwal, lokasi, serta gaji efektif.

### Fase 2 — Presensi dan monitor perusahaan

- Presensi harian.
- Validasi shift dan geofence.
- Koreksi admin.
- Laporan bulanan dan ekspor.
- Monitor perusahaan dan statistik dashboard.

**Exit criteria:** satu siklus presensi bulanan dapat direkap dengan konsisten.

### Fase 3 — Pengajuan dan kunjungan

- Izin/cuti.
- Lembur.
- Kasbon.
- Klaim beban.
- Approval event dan bulk action.
- Jadwal/check-in/laporan kunjungan.

**Exit criteria:** seluruh pengajuan memiliki histori dan dapat mengalir ke payroll bila relevan.

### Fase 4 — Payroll, kasbon, dan keuangan

- Pengaturan payroll.
- Perhitungan dan finalisasi payroll.
- Slip gaji PDF.
- Cicilan dan pembayaran kasbon.
- Istilah serta laporan keuangan operasional.

**Exit criteria:** payroll final dapat direproduksi dari snapshot dan total tidak berubah setelah finalisasi.

### Fase 5 — Langganan dan billing

- Paket dan feature matrix.
- Enforcement limit.
- Invoice dan payment gateway.
- Webhook idempotent.
- Upgrade, downgrade, dan riwayat pembayaran.

**Exit criteria:** pembayaran berhasil mengaktifkan paket tepat satu kali.

### Fase 6 — Pengaturan lanjutan dan hardening

- Pengaturan aplikasi.
- Manajemen user dan undangan.
- User level dinamis.
- IP whitelist dan recovery.
- Notification center.
- Uji keamanan, performa, aksesibilitas, dan responsive behavior.

**Exit criteria:** release candidate lulus checklist keamanan dan regression test.

## 18. Prioritas Rilis

### MVP operasional

- Auth dan organisasi aman.
- Master data inti.
- Profil karyawan lengkap.
- Presensi dan laporan.
- Izin/cuti dan lembur.
- Payroll dasar.

Target relatif: 6–7 sprint dua mingguan untuk satu developer full-stack, setelah keputusan integrasi dikunci.

### Kesetaraan fitur screenshot

- Seluruh MVP.
- Pengumuman dan monitor lanjutan.
- Kunjungan.
- Kasbon dan klaim.
- Keuangan operasional.
- Langganan dan billing.
- User level serta IP whitelist.

Target relatif: 10–12 sprint dua mingguan untuk satu developer full-stack. Estimasi perlu ditinjau ulang setelah spike peta, storage, email, payroll, dan payment gateway.

## 19. Acceptance Criteria Tingkat Produk

Rilis dinyatakan memenuhi PRD jika:

1. Semua route dalam scope tersedia dan dilindungi autentikasi serta permission.
2. Seluruh data bisnis terisolasi per perusahaan.
3. CRUD master data bekerja dengan validasi dan audit yang sesuai.
4. Profil karyawan lengkap beserta file privat dapat dikelola.
5. Presensi menghasilkan status konsisten dari shift dan toleransi.
6. Laporan bulanan dapat difilter serta diekspor.
7. Pengajuan mendukung alur status dan histori persetujuan.
8. Payroll menyimpan snapshot serta dapat difinalisasi secara atomik.
9. Kasbon menghasilkan cicilan dan saldo yang akurat.
10. Paket membatasi fitur serta jumlah karyawan di sisi server.
11. Webhook pembayaran aman dan idempotent.
12. Owner dapat mengelola user, role, permission, dan recovery IP whitelist.
13. Automated test mencakup tenant isolation, permission, perhitungan payroll, dan billing.
14. Tidak ada credential, token, atau file sensitif yang terekspos pada client.

## 20. Strategi Pengujian

### Unit test

- Perhitungan keterlambatan.
- Jarak geofence.
- Saldo cuti.
- Komponen dan total payroll.
- Cicilan kasbon.
- Enforcement limit paket.

### Integration test

- Onboarding perusahaan.
- CRUD dengan tenant guard.
- Approval dan perubahan saldo.
- Finalisasi payroll transaction.
- Webhook pembayaran idempotent.
- Permission per halaman/divisi/aksi.

### End-to-end test

- Register → verifikasi → onboarding → dashboard.
- Tambah master data → tambah karyawan → presensi → laporan.
- Ajukan cuti/lembur → approve → payroll.
- Ajukan kasbon → approve → cicilan → pembayaran.
- Pilih paket → invoice → pembayaran → aktivasi.

## 21. Risiko dan Mitigasi

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Skema membership ganda | Data perusahaan tidak konsisten | Tetapkan satu sumber kebenaran sebelum menambah modul |
| Formula payroll berubah | Slip historis ikut berubah | Simpan snapshot formula dan komponen saat finalisasi |
| Kebocoran dokumen karyawan | Risiko privasi tinggi | Storage privat, signed URL, permission, audit |
| Webhook diproses ganda | Paket/pembayaran ganda | Unique event ID dan transaction |
| Salah hitung geofence | Presensi ditolak/diterima keliru | Simpan akurasi, gunakan toleransi, uji rumus jarak |
| IP whitelist mengunci owner | Tidak dapat login | Recovery flow dan validasi sebelum aktivasi |
| Ekspor besar membebani server | Timeout | Pagination dan job asynchronous |
| Scope bertambah dari menu tanpa referensi | Jadwal meleset | Inventaris dan Tugas Premium tetap out of scope |

## 22. Keputusan Produk yang Masih Terbuka

| ID | Pertanyaan | Dampak |
|---|---|---|
| OD-01 | Map provider apa yang digunakan? | Biaya, API, geocoding, UI |
| OD-02 | Adapter S3-compatible dipakai; provider dan kebijakan retensi produksi masih perlu dipilih. | Keamanan file, retensi, biaya, dan deployment |
| OD-03 | Email provider apa yang digunakan? | Verifikasi, reset, undangan |
| OD-04 | Payment gateway apa yang digunakan? | Metode bayar dan webhook |
| OD-05 | Apakah billing menggunakan prorata? | Upgrade/downgrade dan invoice |
| OD-06 | Bagaimana aturan pajak/BPJS payroll? | Perhitungan payroll |
| OD-07 | Apakah approval satu atau beberapa tingkat? | Skema workflow dan UI |
| OD-08 | Foto selfie langsung diwajibkan; face recognition belum termasuk scope dan memerlukan keputusan privasi terpisah. | Privasi, storage, retensi foto |
| OD-09 | Apakah jabatan dibatasi per divisi? | Model master data |
| OD-10 | Apakah klaim dibayar melalui payroll atau terpisah? | Payroll dan finance flow |
| OD-11 | Apakah desain harus pixel-perfect? | Estimasi frontend |
| OD-12 | Kapan Inventaris dan Tugas Premium masuk scope? | Roadmap berikutnya |

## 23. Definition of Done

Sebuah fitur dianggap selesai apabila:

- Requirement dan acceptance criteria terkait terpenuhi.
- Permission diverifikasi di server.
- Query terikat pada perusahaan aktif.
- Loading, empty, error, dan success state tersedia.
- Validasi client dan server tersedia.
- Aksi penting tercatat di audit log.
- Unit/integration test yang relevan lulus.
- Migration dan seed development tersedia.
- Tampilan desktop dan tablet telah diperiksa.
- Dokumentasi operasional diperbarui.
- Tidak ada lint, type-check, atau build error.

## 24. Catatan Teknis Referensi

Rancangan teknis telah diselaraskan dengan dokumentasi terkini melalui Context7:

- Next.js 16.2.9 App Router: Server Actions untuk mutasi internal, revalidation setelah mutasi, dan Route Handlers untuk webhook eksternal.
- Drizzle ORM: migration terkontrol, composite unique constraints, indeks tenant, relations, dan transaction PostgreSQL.
- Better Auth 1.6.23: email verification, organization/member/invitation, hooks, dan access control.

Prinsip terpenting adalah tidak menggandakan sumber membership, tidak mempercayai `companyId` dari client, dan menggunakan transaction untuk setiap perubahan yang menyentuh saldo, payroll, atau pembayaran.
