# Catatan perubahan tampilan

Tanggal: 1 November 2026

Tujuan perubahan ini adalah memberi TepatWaktu identitas visual sendiri: warna hangat ala Jago, font Plus Jakarta Sans, dan layout yang berbeda dari referensi screenshot awal. **Hanya tampilan yang berubah.** Struktur komponen, data, dan logika tidak disentuh.

## File yang diubah

| File | Isi perubahan |
|---|---|
| `app/refresh.css` (baru) | Lapisan layout baru, dimuat setelah `globals.css`. Hampir semua perubahan layout ada di sini. |
| `app/layout.tsx` | Font Poppins diganti Plus Jakarta Sans (`@fontsource-variable/plus-jakarta-sans`), dan `refresh.css` di-import. |
| `app/globals.css`, `app/feature-additions.css`, `app/registration.css` | Warna diganti ke palet oranye-kuning, charcoal, dan krem. Ukuran font kecil disesuaikan untuk Plus Jakarta Sans. |
| `app/icon.svg`, `app/apple-icon.svg` | Favicon: latar oranye, garis charcoal. |
| Beberapa file TSX dengan style inline (Pengaturan, Superadmin, modal presensi admin) | Warna dan ukuran font inline disesuaikan. |
| `package.json` | Tambah `@fontsource-variable/plus-jakarta-sans`, hapus `@fontsource/poppins`. |

## Font

- Semua teks memakai **Plus Jakarta Sans** versi variable (ketebalan 200–800), jadi ketebalan seperti 550, 650, dan 750 tampil tepat.
- Plus Jakarta Sans tampak lebih kecil daripada Poppins pada ukuran yang sama, jadi ukuran kecil dinaikkan:

  | Ukuran lama | Ukuran baru |
  |---|---|
  | 8–9,5px | 10–11px |
  | 10–11,5px | naik 1px |
  | 12–12,5px | naik 0,5px |
  | 13px ke atas | tetap |

- Judul halaman dibuat lebih besar dan tebal (30px, weight 800), dengan jarak huruf sedikit dirapatkan.

## Logo

- Wordmark: "Tepat" charcoal (putih di latar gelap), "Waktu" oranye.
- Ikon: garis charcoal, jarum jam dan aksen oranye, isi lingkaran krem.
- Favicon dan apple-icon ikut diganti ke latar oranye.

## Layout yang diubah per fitur

### Kerangka aplikasi (semua halaman Dashboard dan Superadmin)
- **Sidebar**: dulu panel putih menempel di tepi kiri. Sekarang panel **charcoal mengambang** dengan sudut membulat besar dan jarak dari tepi layar.
  - Menu aktif berupa pil oranye dengan teks gelap.
  - Sub-menu memakai garis panduan tipis dan titik oranye pada item aktif.
  - Kotak "Pusat bantuan" menjadi kartu gelap dengan ikon oranye.
- **Topbar**: dulu bar putih dengan garis bawah. Sekarang **transparan dengan efek blur** dan menempel saat di-scroll.
  - Nama perusahaan tampil besar seperti sapaan.
  - Tombol Tutorial dan Customer Service, notifikasi, serta kartu user berbentuk pil.
- **Area konten**: latar krem-abu hangat, dan jarak atas dirapatkan karena topbar sudah transparan.

### Header halaman (semua modul)
- Breadcrumb menjadi chip krem kecil di atas judul.
- Judul halaman 30px tebal, dan deskripsi lebih besar.

### Kartu, statistik, dan tabel
Berlaku untuk Dashboard, Monitor Perusahaan, Superadmin, Langganan, dan modul generik.
- Semua kartu memakai sudut 22px, garis tipis hangat, dan bayangan halus berlapis.
- **Kartu statistik**: angka besar dengan angka tabular, ikon dalam kotak membulat, dan garis aksen oranye di bawah kartu.
- **Tabel**: warna belang-belang dihapus. Header huruf kapital kecil di latar krem, baris lebih lega, dan hover berwarna krem.
- Pemisah header kartu memakai garis putus-putus.

### Tombol, input, dan label status
Berlaku di semua halaman.
- Semua tombol berbentuk pil. Tombol utama oranye dengan teks gelap, dan tombol outline bergaris charcoal saat hover.
- Input bersudut 12px dengan cincin fokus oranye.
- Label status dan badge berbentuk pil dengan teks lebih besar.

### Modal dan dialog
Berlaku untuk modal standar, modal kunjungan, dan modal presensi bulanan.
- Tanpa garis tepi, sudut 26px, dan bayangan mengambang.
- Header modal tanpa garis bawah, dan footer putih dengan pemisah putus-putus.

### Login
- **Urutan panel dibalik**: form sekarang di kiri dan panel cerita di kanan.
- Panel cerita menjadi **charcoal** (dulu gradasi biru, lalu oranye) dengan aksen oranye. Panel ini masuk ke dalam kartu dengan sudut membulat.
- Kartu pratinjau "Ringkasan operasional" memakai bayangan blok oranye.
- Input lebih tinggi (52px), dan tombol berbentuk pil.

### Registrasi
- Indikator langkah: lingkaran putih bergaris. Langkah aktif berwarna oranye dengan cincin cahaya.
- Pilihan bidang usaha menjadi kartu bergaris dengan ikon di kotak krem, dan sorotan oranye saat dipilih.
- Kartu paket bersudut 20px dengan sorotan oranye.
- Footer charcoal.

### Halaman fitur dengan kelas CSS sendiri
Halaman berikut tidak memakai kartu dan tabel umum, jadi diberi aturan tambahan supaya tampilannya seragam (kartu membulat, header tabel krem, hover krem):
- Master Data (Shift, Jam Kerja, Divisi, Jabatan, Lokasi Kunjungan, Lokasi Presensi)
- Kunjungan (daftar, laporan, modal)
- Presensi Harian dan Laporan Bulanan
- Monitor Perusahaan
- Izin/Cuti dan Laporan Cuti
- Pengumuman

## Revisi 1: kembali ke putih + oranye Jago

Warna charcoal (hitam) dinilai menghilangkan nuansa Jago, jadi semua panel gelap diganti oranye Jago dengan dasar putih:
- **Sidebar** (dashboard dan superadmin): panel oranye bergradasi dengan teks cokelat tua supaya tetap terbaca. Menu aktif berupa pil putih, dan kotak bantuan putih transparan.
- **Panel cerita di login**: oranye bergradasi, judul charcoal dengan "lebih jelas." putih, dan kartu pratinjau berbayangan putih.
- **Halaman auth lain** (lupa password dan sejenisnya), **hero Langganan**, dan **kartu upgrade**: dari gradasi gelap menjadi oranye.
- **Footer registrasi**: oranye. Header registrasi diberi garis bawah oranye.
- Yang sengaja tetap gelap: viewfinder kamera presensi dan pratinjau foto, supaya foto tetap terlihat jelas.

### Registrasi
- **Langkah 1, Pilih Bidang**: ikon emoji diganti ikon garis lucide (Laptop, Landmark, Utensils, Wrench, Clapperboard, Shapes) dalam kotak krem. Kotak ikon berubah oranye saat bidang dipilih. Judul kartu diberi aksen batang oranye.
- **Langkah 2, Pilih Paket**:
  - Header kartu bergradasi krem dengan ikon tiket.
  - Paket rekomendasi memakai header oranye penuh, ikon mahkota, dan badge putih.
  - Tombol "Pilih Paket" bergaris oranye dan menjadi oranye penuh saat hover.
  - Daftar fitur memakai centang dalam lingkaran oranye.
  - Kartu sedikit terangkat saat hover.
- **Langkah 3, Daftar Akun**: layout disusun ulang.
  - Tombol "Daftar dengan Google" dipindah ke atas, disusul pemisah "atau daftar dengan email".
  - Isian form tetap dua kolom di desktop dan satu kolom di HP.
  - "Paket terpilih" menjadi kartu krem berikon dengan tautan **Ubah**.
  - Tombol Kembali dan Buat akun sejajar di bawah garis pemisah. Sebelumnya tombol Google menumpuk di bawah tombol aksi.

## Revisi 2: Superadmin dan Dashboard

- **Sidebar superadmin**: kotak "Pusat Bantuan Platform" dihapus.
- **Navbar superadmin**: tautan "Grup Telegram" dihapus. Tutorial Youtube dan Customer Service tetap ada.
- **Dashboard dan Monitor Perusahaan digabung**:
  - Menu "Monitor Perusahaan" dihapus dari sidebar.
  - Isi Monitor sekarang tampil di bawah isi Dashboard sebagai section "Monitor Perusahaan", khusus untuk Admin, GM, HRD, dan Manager. Isinya: filter tahun/bulan, laporan absen, 5 karyawan terlambat dan tepat waktu teratas, limit karyawan, dan perbandingan jenis kelamin.
  - Filter periode tetap bekerja di `/dashboard` dan langsung menggulir ke section Monitor.
  - Rute lama `/dashboard/monitor` dialihkan ke `/dashboard#monitor`, jadi tautan atau bookmark lama tetap berfungsi.
  - Daftar adapter di `scripts/check-architecture.mjs` disesuaikan.
- **Detail perusahaan (Superadmin → Semua Perusahaan → detail)**:
  - Header baru berupa kartu tenant: avatar inisial oranye, breadcrumb, nama perusahaan, chip status Aktif, paket, industri, dan zona waktu, serta tombol **Kembali** dan **Masuk sebagai Admin** di kanan.
  - Keterangan kartu statistik dibuat bermakna. Dulu semuanya "Tenant aktif"; sekarang: "Terdaftar di tenant", "x% dari total", "Anggota perusahaan", dan "Sejak 1 {bulan}". "Membership" diganti nama menjadi "Akun login".
  - Paket ditampilkan dengan nama paket, bukan kode.
  - Tabel presensi terbaru memakai badge status berbahasa Indonesia dan format tanggal lokal. Tampilan kosongnya diberi ikon dan keterangan.
  - Kartu langganan: judul lebih besar, dan "Setup Paket & Harga" menjadi tautan krem. Tombol "Kembali ke Perusahaan" dipindah ke header.
  - Daftar administrator berupa baris dengan avatar, nama, email, dan pil peran. Sebelumnya teksnya menempel ke tepi kartu.
- **Topbar**: latar dibuat hampir solid dengan garis bawah tipis, supaya judul halaman tidak tampak hilang tertutup saat halaman di-scroll.

## Belum tercakup penuh

- Halaman **Pengaturan → Aplikasi, IP Whitelist, User Level, User Login** memakai style inline di TSX. Halaman ini sudah mendapat warna dan font baru, tetapi bentuk kartu dan tabelnya belum mengikuti layout baru. Supaya ikut, style inline perlu dipindah ke kelas CSS.
- Tampilan dashboard dicek lewat halaman preview statis yang memakai CSS asli. Halaman yang butuh login belum dicek langsung di aplikasi yang berjalan.
