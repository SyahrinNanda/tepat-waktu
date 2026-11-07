# Deploy ke VPS dengan Coolify, Dockerfile, dan Cloudflare R2

Susunan produksi:

- **VPS + Coolify**: menjalankan container dan memasang HTTPS (Let's Encrypt) otomatis.
- **`docker-compose.prod.yml`**: service `migrate` (migrasi database tiap deploy) lalu `app` (Next.js dari `Dockerfile`).
- **PostgreSQL**: resource database di Coolify (atau server lain).
- **Cloudflare R2**: penyimpanan file (foto presensi, dokumen) lewat protokol S3.
- **Email**: Brevo → Mailjet → Mailtrap dengan fallback (lihat `docs/AUTH.md`).

## 1. Siapkan layanan luar

1. **Cloudflare R2**
   - Buat bucket privat, mis. `tepatwaktu-private`. Jangan aktifkan akses publik.
   - R2 → Manage API Tokens → buat token **Object Read & Write** khusus bucket itu. Catat Access Key ID, Secret Access Key, dan Account ID.
   - Endpoint: `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`.
2. **Email**: buat akun Brevo, Mailjet, dan Mailtrap; verifikasi domain pengirim (SPF dan DKIM) di ketiganya; ambil kredensial SMTP masing-masing. Cocokkan host dan port dengan dokumentasi tiap layanan.
3. **Domain**: arahkan record A (mis. `app.domain-anda.com`) ke IP VPS.

## 2. Siapkan Coolify

1. Pasang Coolify di VPS (ikuti panduan resmi Coolify).
2. Buat **PostgreSQL** (versi 17) sebagai resource. Salin *internal connection URL* untuk `DATABASE_URL`. Aktifkan **scheduled backup**; tujuan backup bisa diarahkan ke bucket R2 terpisah (S3-compatible).
3. Buat resource aplikasi dari repository Git dengan **Build Pack: Docker Compose** dan file `docker-compose.prod.yml`.
4. Pada service `app`, isi domain `https://app.domain-anda.com` dengan port **3000**.

## 3. Variabel lingkungan

Isi di Coolify → Environment Variables. `NEXT_PUBLIC_APP_URL` juga dicentang **Build Variable** karena ditanam saat build.

```env
DATABASE_URL=postgresql://...            # dari resource PostgreSQL Coolify
BETTER_AUTH_SECRET=...                   # acak, minimal 32 karakter (mis. openssl rand -base64 48)
BETTER_AUTH_URL=https://app.domain-anda.com
NEXT_PUBLIC_APP_URL=https://app.domain-anda.com

OBJECT_STORAGE_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com
OBJECT_STORAGE_REGION=auto
OBJECT_STORAGE_BUCKET=tepatwaktu-private
OBJECT_STORAGE_ACCESS_KEY=...
OBJECT_STORAGE_SECRET_KEY=...
OBJECT_STORAGE_FORCE_PATH_STYLE=true
OBJECT_STORAGE_AUTO_CREATE_BUCKET=false

MAIL_FROM="TepatWaktu <noreply@domain-anda.com>"
MAIL_PROVIDERS=brevo,mailjet,mailtrap   # wajib ketiganya: fallback otomatis saat kuota/error
                                        # SPF: satu record TXT gabungan include ketiga layanan
                                        # DAILY_LIMIT sebaiknya sedikit di bawah kuota asli (mis. 290/190/140)
SMTP_BREVO_HOST=smtp-relay.brevo.com
SMTP_BREVO_PORT=587
SMTP_BREVO_USER=...
SMTP_BREVO_PASS=...
SMTP_BREVO_DAILY_LIMIT=300
SMTP_MAILJET_HOST=in-v3.mailjet.com
SMTP_MAILJET_PORT=587
SMTP_MAILJET_USER=...
SMTP_MAILJET_PASS=...
SMTP_MAILJET_DAILY_LIMIT=200
SMTP_MAILTRAP_HOST=live.smtp.mailtrap.io
SMTP_MAILTRAP_PORT=587
SMTP_MAILTRAP_USER=...
SMTP_MAILTRAP_PASS=...
SMTP_MAILTRAP_DAILY_LIMIT=150

CRON_SECRET=...                          # opsional, untuk cron eksternal
REMINDER_SCHEDULER=on
CLIENT_IP_HEADER=x-real-ip               # cf-connecting-ip jika domain lewat proxy Cloudflare

MIDTRANS_SERVER_KEY=...                  # Midtrans → Settings → Access Keys
MIDTRANS_CLIENT_KEY=...
MIDTRANS_IS_PRODUCTION=false             # true setelah akun Midtrans live disetujui

# Superadmin pertama (dibaca service "migrate"). Hanya dibuat jika belum ada superadmin sama sekali.
SUPERADMIN_EMAIL=anda@domain-anda.com
SUPERADMIN_PASSWORD=...                  # 8–128 karakter; HAPUS variabel ini setelah berhasil login
SUPERADMIN_NAME="Nama Anda"              # opsional
```

Variabel wajib yang kosong membuat deploy berhenti dengan pesan "Isi ...".

## 4. Deploy

1. Klik **Deploy**. Urutannya: build image → `migrate` menjalankan migrasi lalu berhenti → `app` menyala.
2. Container `migrate` berstatus *exited (0)* setelah deploy; itu normal.
3. **Superadmin pertama** dibuat otomatis oleh `migrate` dari `SUPERADMIN_EMAIL` dan `SUPERADMIN_PASSWORD` (log: `[superadmin] Superadmin dibuat: ...`). Login di `https://app.domain-anda.com`, lalu **hapus `SUPERADMIN_PASSWORD`** dari environment Coolify. Deploy berikutnya menulis `Sudah ada superadmin, dilewati`, jadi akun tidak pernah ditimpa. **Jangan jalankan `npm run db:seed` di production**: perintah itu membuat perusahaan dan akun demo dengan password yang diketahui umum.
   - Lupa password superadmin atau perlu superadmin tambahan: dari terminal mana pun yang bisa menjangkau database, `DATABASE_URL=... npm run superadmin:create -- --email anda@domain.com --password "PasswordBaru" --reset-password`. Akun yang sudah ada dijadikan superadmin; tanpa `--reset-password` password lamanya dipertahankan.

## 4b. Midtrans

Di dashboard Midtrans (sandbox: dashboard.sandbox.midtrans.com, live: dashboard.midtrans.com) → **Settings → Payment → Notification URL**:

- **Payment Notification URL:** `https://app.domain-anda.com/api/payments/midtrans/notification`
- **Finish / Unfinish / Error Redirect URL:** `https://app.domain-anda.com/dashboard/langganan/pembayaran/berhasil` (aplikasi juga mengirim URL ini per transaksi).

Aktifkan metode yang ditawarkan aplikasi di **Settings → Snap Preferences**: VA (BCA, BNI, BRI, Mandiri, Permata, CIMB), QRIS, GoPay, ShopeePay, kartu kredit, Indomaret, Alfamart, Akulaku. Metode yang tidak aktif di Midtrans tidak akan muncul di jendela pembayaran.

Pindah ke live: ganti kedua key dengan key production dan set `MIDTRANS_IS_PRODUCTION=true`, lalu deploy ulang.

## 5. Uji setelah deploy

- [ ] Halaman login terbuka lewat HTTPS.
- [ ] Daftar perusahaan baru → email verifikasi masuk → tautan membuka dashboard.
- [ ] Lupa password → email masuk → password baru bisa dipakai login.
- [ ] Upload foto presensi berhasil dan file muncul di bucket R2.
- [ ] Super Admin → Retensi menampilkan layanan email "Siap".
- [ ] Setelah check-in, IP yang tercatat di detail presensi adalah IP publik pengguna (bukan IP Docker/Cloudflare seperti `10.x`, `172.x`). Jika salah, sesuaikan `CLIENT_IP_HEADER`.
- [ ] Midtrans sandbox: buat invoice berbayar → Bayar Sekarang → bayar dengan simulator (simulator.sandbox.midtrans.com) → paket aktif otomatis dan status di Super Admin → Semua Langganan menjadi "Lunas via Midtrans". Dashboard Midtrans → Notification history menunjukkan respons 200.
- [ ] Backup database terjadwal aktif di Coolify (Database → Backups), dan satu kali restore sudah dicoba.

## Catatan

- **IP asli pengunjung.** Log presensi dan rate limit login membaca IP dari `CLIENT_IP_HEADER`. Jika memakai proxy Cloudflare (awan oranye) dengan `cf-connecting-ip`, pastikan VPS hanya menerima lalu lintas HTTP/HTTPS dari Cloudflare (firewall atau Cloudflare Tunnel); kalau tidak, header itu bisa dipalsukan dengan mengakses IP VPS langsung.

- **Satu instance aplikasi.** Penjadwal email pengingat berjalan di dalam aplikasi. Jika `app` dijalankan lebih dari satu replika, set `REMINDER_SCHEDULER=off` dan buat **Scheduled Task** di Coolify yang tiap jam menjalankan `curl -H "Authorization: Bearer $CRON_SECRET" https://app.domain-anda.com/api/cron/subscription-reminders`.
- **Port SMTP.** Beberapa penyedia VPS memblokir email keluar untuk akun baru. Uji dari VPS: `nc -vz smtp-relay.brevo.com 587`. Jika diblokir, pakai port alternatif dari layanan email (umumnya 2525) atau minta penyedia VPS membukanya.
- **Docker lokal** (`docker-compose.yml`) tetap memakai PostgreSQL, SeaweedFS, dan Mailpit lokal untuk pengembangan.
