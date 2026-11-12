# TepatWaktu

Portal manajemen kehadiran berbasis Next.js, PostgreSQL, Drizzle ORM, dan Better Auth. Desain halaman publik mengambil referensi pola interaksi portal mitra Presensi.co.id yang diamati secara read-only, dengan merek dan implementasi orisinal.

## Fitur

- Login email/password, verifikasi email, dan reset password melalui Better Auth (lihat `docs/AUTH.md`).
- Onboarding bertahap: bidang usaha, paket, akun, dan ruang kerja.
- Isolasi data per perusahaan (multi-tenant).
- Manajemen karyawan dan status aktif.
- Jadwal kerja dan toleransi keterlambatan.
- Check-in/check-out karyawan dengan foto kamera langsung, waktu server, koordinat,
  dan pencegahan presensi ganda.
- Input presensi karyawan oleh Admin perusahaan dan Superadmin dengan alasan audit.
- Penyimpanan foto privat melalui adapter S3-compatible agar provider dapat diganti
  tanpa mengubah logika aplikasi.
- Pengajuan cuti, sakit, izin, serta alur setuju/tolak.
- Dashboard dan laporan agregat 30 hari.
- Form penghapusan data karyawan dan pemulihan password yang aman terhadap enumerasi email.
- Tampilan responsif untuk desktop dan seluler.

## Menjalankan seluruh stack dengan Docker

Prasyarat: Docker Desktop dengan Docker Compose.

```bash
docker compose --env-file .env.local up -d --build app
docker compose up -d --build
```

Perintah tersebut otomatis menjalankan aplikasi Next.js, PostgreSQL, migrasi
Drizzle, dan object storage SeaweedFS. Tunggu sampai service `tepatwaktu-app`
berstatus `healthy`, lalu buka `http://localhost:3000`.

```bash
docker compose ps
docker compose logs -f app
```

Untuk menghentikan stack tanpa menghapus database maupun file:

```bash
docker compose down
```

Data persisten disimpan dalam volume Compose `tepatwaktu_database_data` dan
`tepatwaktu_object_storage_data`. Jangan gunakan `docker compose down -v`
kecuali memang ingin menghapus seluruh data.

Seed demo hanya perlu dijalankan saat database masih kosong:

```bash
docker compose run --rm migrate npm run db:seed
```

## Menjalankan lokal tanpa Docker (Windows)

Mode ini lebih ringan untuk pengembangan dan testing. **Deploy tetap memakai
`Dockerfile` dan `docker-compose.prod.yml`**, jadi tidak ada yang berubah untuk produksi.

Tiga service berjalan sebagai proses biasa (bukan Windows service), sehingga tidak
ada yang tetap menyala setelah `npm run local:stop` atau restart komputer:

| Service | Alamat lokal | Lokasi file |
|---|---|---|
| PostgreSQL 17 (portable) | `localhost:5432` | binary `D:mini-datapgsql`, data `D:mini-datapgdata`, log `D:mini-datapostgres.log` |
| Object storage SeaweedFS | `http://127.0.0.1:18334` | binary `D:mini-dataweed.exe`, data `D:mini-data	epatwaktu` |
| Mailpit (inbox email) | inbox `http://localhost:8025`, SMTP `localhost:1025` | `D:mini-datamailpit` |
| Aplikasi (`npm run dev`) | `http://localhost:3000` | – |

Semua perintah dijalankan dari folder proyek. Pengaturannya ada di
`scripts/local-services.ps1`.

### Persiapan (sekali saja)

1. Salin `.env.example` menjadi `.env.local` bila belum ada. Untuk mode lokal pastikan nilainya:

   ```env
   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/tepatwaktu
   OBJECT_STORAGE_ENDPOINT=http://127.0.0.1:18334
   MAIL_PROVIDERS=mailpit
   SMTP_MAILPIT_HOST=localhost
   SMTP_MAILPIT_PORT=1025
   ```

2. Pastikan `D:mini-dataweed.exe` ada. Bila belum ada, unduh SeaweedFS `windows_amd64`
   dari GitHub releases lalu taruh `weed.exe` di `D:mini-data`.
3. Matikan container Docker supaya port 5432, 8025, dan 1025 kosong:

   ```bash
   docker compose down
   ```

4. Pasang dependency: `npm install`
5. Siapkan service lokal:

   ```bash
   npm run local:setup
   ```

   Perintah ini mengunduh PostgreSQL 17 portable (sekitar 300 MB, tanpa pgAdmin) dan
   Mailpit, membuat cluster database dengan user dan password yang sama seperti di
   `DATABASE_URL`, lalu membuat database `tepatwaktu`.

6. Isi database. Pilih salah satu:

   - **Pindahkan data lama dari Docker.** Docker Desktop perlu menyala sekali ini saja.
     Data lokal akan diganti dengan isi database di volume Docker.

     ```bash
     npm run local:import-docker
     npm run db:migrate
     ```

   - **Mulai dari data demo baru** (khusus lokal, jangan jalankan seed di produksi):

     ```bash
     npm run db:migrate
     npm run db:seed
     ```

### Setiap kali mulai bekerja

```bash
npm run local:start    # PostgreSQL + object storage + Mailpit
npm run db:migrate     # hanya bila ada migrasi baru
npm run dev            # buka http://localhost:3000
```

Selesai bekerja: tekan Ctrl+C di jendela `npm run dev`, lalu:

```bash
npm run local:stop
```

### Perintah lain

| Perintah | Fungsi |
|---|---|
| `npm run local:status` | Menampilkan service mana yang berjalan atau berhenti |
| `npm run local:import-docker` | Menyalin database dari volume Docker ke PostgreSQL lokal |
| `npm run storage:start` / `storage:stop` | Hanya menyalakan atau mematikan object storage |
| `npm run db:studio` | Melihat isi database lewat Drizzle Studio |
| `npm run build` lalu `npm run start` | Menguji build produksi tanpa Docker |

### Catatan dan masalah umum

- **Foto lama tidak ikut pindah.** `local:import-docker` hanya memindahkan isi database.
  Foto yang diunggah saat aplikasi berjalan di Docker tersimpan di volume Docker, jadi
  tampil kosong di mode lokal. Foto yang diunggah di mode lokal tersimpan di
  `D:mini-data	epatwaktu`.
- **"Port 5432 dipakai proses lain"**: container Docker atau PostgreSQL lain masih menyala.
  Jalankan `docker compose down` atau matikan PostgreSQL lain, lalu ulangi `npm run local:start`.
- **PostgreSQL gagal menyala**: lihat `D:mini-datapostgres.log`.
- **Email tidak terkirim**: pastikan Mailpit berjalan (`npm run local:status`) dan
  `SMTP_MAILPIT_HOST=localhost` di `.env.local`.
- **Mengulang database dari nol**: `npm run local:stop`, hapus folder `D:mini-datapgdata`,
  lalu jalankan lagi `npm run local:setup` dan isi ulang database (langkah 6).

Buka `http://localhost:3000`. Akun seed:

```text
admin@tepatwaktu.id
TepatWaktu123!
```

Akun demo lain menggunakan password yang sama:

| Email | Role |
| --- | --- |
| `superadmin@tepatwaktu.id` | Superadmin seluruh platform |
| `andi@tepatwaktu.id` | General Manager |
| `salsa@tepatwaktu.id` | HRD |
| `raka@tepatwaktu.id` | Manager |
| `maya@tepatwaktu.id` | Karyawan/Staf |
| `bima@tepatwaktu.id` | Karyawan/Staf |

Superadmin dan Admin tidak melakukan presensi untuk dirinya sendiri. Keduanya
dapat memasukkan check-in/check-out bagi General Manager, HRD, Manager, dan
Karyawan/Staf. Admin dibatasi pada perusahaannya; Superadmin dapat memilih
perusahaan.

Ganti kredensial demo sebelum dipakai di lingkungan publik.

## Variabel lingkungan

| Nama | Kegunaan |
| --- | --- |
| `DATABASE_URL` | Connection string PostgreSQL. |
| `BETTER_AUTH_SECRET` | Secret acak minimal 32 karakter. |
| `BETTER_AUTH_URL` | URL canonical server Better Auth. |
| `NEXT_PUBLIC_APP_URL` | URL publik aplikasi untuk klien auth. |
| `MAIL_PROVIDERS`, `SMTP_<NAMA>_*`, `MAIL_FROM` | Email verifikasi, reset password, dan pengingat dengan fallback antar layanan (lihat `.env.example`). |
| `OBJECT_STORAGE_ENDPOINT` | Endpoint S3-compatible. Kosongkan untuk AWS S3; lokal saat ini memakai `http://127.0.0.1:18334`. |
| `OBJECT_STORAGE_REGION` | Region bucket, misalnya `us-east-1`. |
| `OBJECT_STORAGE_BUCKET` | Nama bucket privat untuk aset TepatWaktu. |
| `OBJECT_STORAGE_ACCESS_KEY` / `OBJECT_STORAGE_SECRET_KEY` | Kredensial object storage. |
| `OBJECT_STORAGE_FORCE_PATH_STYLE` | `true` untuk MinIO/SeaweedFS; biasanya `false` untuk AWS S3. |
| `OBJECT_STORAGE_AUTO_CREATE_BUCKET` | Membuat bucket otomatis pada development bila belum ada. |
| `GEOAPIFY_API_KEY` | API key Geoapify untuk pencarian lokasi presensi. |
| `TOMTOM_API_KEY` | API key TomTom Places Search untuk pencarian lokasi presensi. |

Isi `GEOAPIFY_API_KEY` dan/atau `TOMTOM_API_KEY` di `.env.local` untuk menggabungkan
hasilnya dengan Nominatim. Key TomTom dibuat di [MyTomTom](https://my.tomtom.com/).
Saat memakai Docker Compose, jalankan `docker compose up -d app` agar container
mengambil konfigurasi terbaru. Saat menjalankan Next.js langsung, mulai ulang
server. API key hanya dipakai di server dan tidak dikirim ke browser. Jika satu
layanan gagal, hasil dari layanan lain tetap tersedia. Pemilihan titik lewat
peta dan input koordinat manual tetap tersedia.

## Perintah penting

```bash
npm run lint
npm run build
npm run db:generate
npm run db:migrate
npm run db:studio
npm run db:seed
npm run storage:start
npm run storage:stop
docker compose up -d --build
docker compose down
```

File skema ada di `db/schema.ts`; migrasi SQL tersimpan di folder `drizzle/`.

## Integrasi frontend dan backend

Route berikut sudah menggunakan session Better Auth dan data PostgreSQL nyata,
bukan data contoh:

- `/dashboard`, `/dashboard/laporan`, dan `/dashboard/jadwal`;
- `/dashboard/karyawan`, tambah karyawan, serta detail/edit karyawan;
- `/dashboard/presensi/check-in`, input presensi Admin, presensi harian,
  laporan bulanan, dan detail audit presensi;
- `/dashboard/pengajuan` serta daftar/detail izin dan cuti;
- `/superadmin`, daftar/detail perusahaan, dan input presensi lintas tenant.

Mutasi form menggunakan Server Actions dengan validasi Zod, pemeriksaan role dan
tenant di server, kemudian melakukan revalidasi halaman terkait. Presensi kamera
tetap menggunakan Route Handler karena payload-nya berupa multipart foto dan
metadata lokasi.

Modul pengumuman, master organisasi lanjutan, kunjungan, payroll, kasbon,
keuangan, serta billing masih merupakan UI tahap berikutnya dan belum boleh
dianggap sebagai data produksi.

## Catatan produksi

- Gunakan secret unik dan database terkelola dengan TLS.
- Gunakan bucket privat, kredensial khusus aplikasi, TLS, dan jaringan privat
  untuk object storage produksi. Endpoint file aplikasi selalu memeriksa session
  dan hak akses sebelum melakukan streaming objek.
- Isi kredensial SMTP (`MAIL_PROVIDERS`) agar email verifikasi dan reset password terkirim.
- Deploy produksi (VPS + Coolify + Cloudflare R2): lihat `docs/DEPLOY-VPS-COOLIFY.md` dan `docker-compose.prod.yml`. Migrasi berjalan otomatis lewat service `migrate` sebelum aplikasi menyala.
