# Akun dan login TepatWaktu

Semua akun, sesi login, verifikasi email, dan reset password ditangani **Better Auth** di dalam aplikasi. Data akun tersimpan di PostgreSQL aplikasi (tabel `user`, `account`, `session`, `verification`). Tidak ada layanan auth eksternal dan tidak ada login Google.

## Alur pendaftaran perusahaan baru

1. Pendaftar mengisi `/register`: bidang, paket (durasi dan kupon untuk paket berbayar), lalu data perusahaan dan akun admin.
2. `POST /api/registration` (`lib/registration/register.ts`):
   - membuat akun Better Auth yang **belum terverifikasi** (belum bisa login),
   - menyimpan data perusahaan di tabel `registration_requests`,
   - mengirim email verifikasi (berlaku 24 jam).
3. Pendaftar membuka tautan `/api/auth/verify-email?token=...`. Better Auth menandai email terverifikasi, langsung memasukkan pengguna (auto sign-in), lalu `afterEmailVerification` membuat perusahaan, keanggotaan admin, Free Trial, dan invoice pertama (`lib/registration/provision.ts`).
4. Halaman `/verifikasi-email/berhasil` mengarahkan ke dashboard. Jika pembuatan perusahaan sempat gagal, `/masuk/lanjut` mencobanya lagi saat login.

Aturan tambahan:

- Mendaftar ulang dengan email yang **belum** diverifikasi mengganti pendaftaran lama (data dan password baru).
- Email yang sudah terverifikasi ditolak dengan "Email sudah terdaftar".
- Login dengan akun yang belum terverifikasi ditolak, dan tautan verifikasi baru otomatis dikirim.
- Halaman verifikasi punya tombol **Kirim ulang tautan verifikasi**.
- `POST /api/auth/sign-up/email` sengaja diblokir: pendaftaran publik hanya lewat `/api/registration` agar data perusahaan ikut tersimpan.
- Akun karyawan yang dibuat admin perusahaan langsung ditandai terverifikasi dan **tidak** dikirimi email verifikasi (`sendOnSignUp: false` di `lib/auth.ts`).

## Lupa password

1. `/lupa-password` → `POST /api/password-reset`. Jawabannya selalu sama, terdaftar atau tidak, agar alamat akun tidak bisa ditebak.
2. Email berisi tautan `/api/auth/reset-password/<token>` yang berlaku **1 jam** dan sekali pakai, diarahkan ke `/atur-password?token=...`.
3. Setelah password baru disimpan, semua sesi login lain dikeluarkan.

## Penghapusan akun

1. Pengguna mengisi email (dan alasan opsional) di `/penghapusan-akun`. Responsnya selalu sama, terdaftar atau tidak.
2. Jika email terdaftar, tautan konfirmasi dikirim (berlaku 24 jam, token disimpan sebagai hash SHA-256). Permintaan ulang dalam 2 menit tidak mengirim email baru, dan permintaan yang sudah dikonfirmasi tidak bisa digandakan.
3. Tautan membuka `/penghapusan-akun/konfirmasi`; permintaan baru masuk antrean setelah tombol konfirmasi diklik, sehingga pemindai tautan di email tidak bisa mengonfirmasi sendiri.
4. Superadmin meninjau di **Superadmin → Permintaan Hapus Akun** (`features/account-requests`, `app/superadmin/penghapusan-akun`):
   - **Proses** menghapus akun beserta sesi dan keanggotaan perusahaannya. Data perusahaan tidak ikut terhapus.
   - Diblokir jika akun itu satu-satunya admin aktif di sebuah perusahaan, atau akun Super Admin.
   - **Tolak** dengan alasan opsional.
5. Pemohon yang sudah mengonfirmasi menerima email hasil (dihapus atau ditolak beserta alasannya). Keduanya tercatat di Log Aktivitas.

## Pengiriman email

Email verifikasi dan reset password dikirim lewat `lib/mailer.ts` dengan fallback Brevo → Mailjet → Mailtrap (lihat `.env.example`, `MAIL_PROVIDERS`). Isi email ada di `lib/registration/auth-emails.ts`. Pengiriman tidak ditunggu (praktik yang dianjurkan Better Auth untuk mencegah timing attack); kegagalan dicatat di log aplikasi dan pengguna bisa meminta tautan baru.

## Keamanan bawaan

- Pembatasan percobaan (rate limit) Better Auth aktif di produksi, mis. login maksimal 3 kali per 10 detik per IP.
- `BETTER_AUTH_SECRET` wajib acak dan minimal 32 karakter; `BETTER_AUTH_URL` dan `NEXT_PUBLIC_APP_URL` harus domain HTTPS produksi.

## Akun lama

Akun yang dibuat sebelumnya tetap login dengan password yang sama. Jika ada akun yang dulu dibuat lewat Supabase dan belum punya password di aplikasi, pemiliknya cukup memakai **Lupa password**; Better Auth membuat password baru untuk akun tersebut.
