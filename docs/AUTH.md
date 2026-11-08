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

## Undangan user lewat email

**Tempat utama: Karyawan → Tambah.** Kotak **"Buat akun login & kirim undangan email"** (default aktif) membuat data karyawan, akun login dengan email yang sama (level *Karyawan / Staf*), dan mengirim undangan sekaligus, lalu membuka detail karyawan dengan hasilnya. Data karyawan dan akun selalu tertaut, jadi tidak ada data ganda karena email berbeda. Logika: `features/invitations/server/employee-account.ts` (`provisionEmployeeAccount`).

- **Detail karyawan** menampilkan kartu **Akun login**: Aktif / Menunggu undangan / Undangan kedaluwarsa / Belum punya akun, dengan tombol **Buat akun & kirim undangan** atau **Kirim ulang undangan** (admin, GM, HRD). Data karyawan lama tanpa akun cukup memakai tombol ini.
- **Daftar karyawan** punya kolom **Akun Login**.
- **Email karyawan diubah** sebelum undangan dipakai: email login ikut berubah dan undangan baru dikirim ke alamat baru (tautan lama batal). Setelah karyawan membuat password, email login tidak diubah diam-diam; admin diberi keterangan.
- Email yang sudah dipakai akun di perusahaan lain: data karyawan tetap tersimpan, akun tidak dibuat, alasannya ditampilkan. Email yang sudah punya akun di perusahaan ini: akun itu ditautkan.
- **Pengaturan → Users** tetap dipakai untuk akun HRD/Manager/GM/admin dan untuk mengubah level user, dengan opsi undangan yang sama:

Admin perusahaan menambah user di **Pengaturan → Users**. Opsi **"Kirim undangan lewat email"** aktif secara default:

1. Akun dibuat dengan password acak yang tidak diketahui siapa pun, keanggotaan perusahaan dan data karyawan (non-admin) ikut dibuat/ditautkan seperti biasa.
2. `features/invitations/server/invitations.ts` membuat token acak 32 byte (yang disimpan hanya SHA-256-nya di tabel `user_invitations`, migrasi `0040`) dan mengirim email "Anda diundang ke <perusahaan>" dengan tautan `/undangan?token=...`.
3. Tautan berlaku **7 hari** dan **sekali pakai**. Membuka tautan hanya menampilkan form; password disimpan saat form dikirim (POST), jadi pemindai tautan di email tidak bisa memakainya.
4. Setelah password dibuat: undangan ditandai terpakai, email ditandai terverifikasi, sesi lain akun itu dikeluarkan.
5. Di daftar user tampil label **Menunggu undangan** / **Undangan kedaluwarsa**; menu ⋮ → **Kirim ulang undangan** membuat tautan baru (tautan lama langsung tidak berlaku, jeda 1 menit antar kiriman).
6. Tautan tidak berlaku lagi bila user sudah dikeluarkan dari perusahaan.

Tanpa opsi undangan, admin mengisi password sendiri seperti sebelumnya.

## Status user dan OTP Login

- **Status** (Pengaturan → Users): user nonaktif langsung keluar dari semua perangkat, tidak bisa login (`databaseHooks.session.create.before` di `lib/auth.ts` menolak pembuatan sesi), dan sesi lama dianggap keluar (`getAppSession`). Status akun Administrator hanya bisa diubah Superadmin (Super Admin → Kelola Seluruh Akun → Status).
- **OTP Login** (default off): plugin Better Auth `twoFactor` dengan OTP email. Setelah password benar, server membalas `twoFactorRedirect`; form login meminta kode 6 digit yang dikirim ke email (`sendLoginOtpEmail`), berlaku 5 menit, disimpan sebagai hash. Sakelar OTP mengatur `user.two_factor_enabled` dan baris `two_factor` lewat `lib/otp-login.ts`. TOTP dan backup code tidak dipakai.

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

Email verifikasi dan reset password dikirim lewat `lib/mailer.ts` dengan fallback Mailjet → Mailtrap → Brevo (urutan dari `MAIL_PROVIDERS`; lihat `.env.example`, `MAIL_PROVIDERS`). Isi email ada di `lib/registration/auth-emails.ts`. Pengiriman tidak ditunggu (praktik yang dianjurkan Better Auth untuk mencegah timing attack); kegagalan dicatat di log aplikasi dan pengguna bisa meminta tautan baru.

## Keamanan bawaan

- Pembatasan percobaan (rate limit) Better Auth aktif di produksi, mis. login maksimal 3 kali per 10 detik per IP.
- `BETTER_AUTH_SECRET` wajib acak dan minimal 32 karakter; `BETTER_AUTH_URL` dan `NEXT_PUBLIC_APP_URL` harus domain HTTPS produksi.

## Akun lama

Akun yang dibuat sebelumnya tetap login dengan password yang sama. Jika ada akun yang dulu dibuat lewat Supabase dan belum punya password di aplikasi, pemiliknya cukup memakai **Lupa password**; Better Auth membuat password baru untuk akun tersebut.
