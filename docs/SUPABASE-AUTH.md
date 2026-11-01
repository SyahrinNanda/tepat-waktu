# Supabase Auth untuk TepatWaktu

Pendaftaran baru, verifikasi email, Google, dan pemulihan password menggunakan Supabase Auth. Akun lama tetap dapat masuk dengan password Better Auth yang sudah ada. Data perusahaan dan hak akses tetap berada di tabel aplikasi PostgreSQL.

## Konfigurasi aplikasi

Tambahkan nilai berikut ke `.env.local` dan ke Environment Variables Vercel:

```env
NEXT_PUBLIC_SUPABASE_URL=https://PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Di Vercel, isi `NEXT_PUBLIC_APP_URL` dengan domain HTTPS produksi. Tetap isi `DATABASE_URL`, `BETTER_AUTH_SECRET`, dan pengaturan storage yang diperlukan aplikasi. Jangan menaruh service role key Supabase di browser.

## Pengaturan Supabase Dashboard

1. **Authentication → Providers → Email:** aktifkan Email dan **Confirm email**.
2. **Authentication → URL Configuration:** isi Site URL aplikasi dan tambahkan redirect URL `http://localhost:3000/auth/callback` serta `https://DOMAIN-ANDA/auth/callback`.
3. **Authentication → Providers → Google:** aktifkan Google, lalu isi Google Client ID dan Client Secret di Supabase. Pada Google Cloud Console, gunakan callback URL Supabase yang ditampilkan di halaman provider tersebut (`https://PROJECT_REF.supabase.co/auth/v1/callback`), bukan callback Next.js.
4. **Authentication → Email Templates → Confirm signup:** gunakan tautan `<a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=email">Verifikasi email</a>`. Aplikasi mengirim `emailRedirectTo` menuju `/auth/callback`, sehingga `RedirectTo` sudah berisi alamat callback lengkap.
5. **Authentication → Email Templates → Reset password:** gunakan tautan `<a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=recovery">Atur password baru</a>`. Callback memvalidasi token lalu membuka halaman password baru selama 10 menit.

Layanan email bawaan Supabase untuk proyek hosted hanya cocok untuk uji coba dan umumnya membatasi penerima pada anggota tim proyek. Agar pendaftar umum menerima email, atur **Authentication → SMTP Settings** dengan penyedia SMTP pilihan Anda. Aplikasi tidak menggunakan Resend.

## Alur akun

- Daftar dengan email: Supabase mengirim tautan verifikasi. Setelah tautan dibuka, callback membuat akun lokal dan ruang kerja dari data pendaftaran.
- Daftar dengan Google: setelah Google menyetujui login, pendaftar memilih bidang dan paket lalu melengkapi perusahaan. Akun Google yang emailnya sama dengan akun lama memakai data lokal yang sudah ada.
- Login akun lama: Better Auth tetap menerima password lama. Login akun baru memakai Supabase Auth. Pemulihan password melalui email Supabase hanya berlaku untuk identitas yang sudah ada di Supabase; akun Better Auth lama tetap dapat masuk dengan password lamanya dan dapat mengubah password melalui profil setelah login.
- Tombol Google pada login dan daftar hanya aktif jika variabel publik Supabase sudah diisi.

Untuk pengujian end to end, gunakan alamat email yang dapat menerima pesan dari konfigurasi SMTP proyek Supabase dan pastikan callback URL terdaftar tepat.
