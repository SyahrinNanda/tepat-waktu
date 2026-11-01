# TepatWaktu

Portal manajemen kehadiran berbasis Next.js, PostgreSQL, Drizzle ORM, dan Better Auth. Desain halaman publik mengambil referensi pola interaksi portal mitra Presensi.co.id yang diamati secara read-only, dengan merek dan implementasi orisinal.

## Fitur

- Login email/password dan Google OAuth opsional melalui Better Auth.
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

## Menjalankan tanpa container aplikasi

Untuk pengembangan Next.js langsung dari Windows, salin `.env.example` menjadi
`.env.local`, lalu jalankan PostgreSQL/object storage yang sesuai, migrasi, dan
development server secara manual. Script `npm run storage:start` tetap tersedia
khusus mode pengembangan lokal dan memakai data di `D:\mini-data\tepatwaktu`.

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
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Opsional, mengaktifkan OAuth Google di server. |
| `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED` | Set `true` agar tombol Google aktif di UI. |
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
- Hubungkan provider email ke konfigurasi Better Auth sebelum mengaktifkan reset password sungguhan. Endpoint contoh saat ini mengembalikan respons generik dan tidak mengirim email.
- Konfigurasikan kredensial Google OAuth beserta callback `/api/auth/callback/google` bila diperlukan.
- Jalankan `npm run db:migrate` sebagai langkah rilis sebelum menyalakan versi aplikasi baru.
