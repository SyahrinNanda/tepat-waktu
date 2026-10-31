# Feature boundaries

Kode pada folder ini dikelompokkan berdasarkan domain bisnis. Folder `app/`
hanya menjadi boundary routing Next.js, metadata, layout, dan adapter Route
Handler. URL aplikasi tetap berada di bawah `/dashboard`.

- `account-requests`: permintaan reset kata sandi dan penghapusan akun.
- `announcements`: UI, upload gambar, dan CRUD pengumuman.
- `attendance`: UI kamera, form admin, service, dan handler presensi.
- `generic-modules`: modul lama berbasis konfigurasi sampai memiliki tabel khusus.
- `leave-requests`: UI dan alur permohonan izin/cuti.
- `master-data`: shift, jam kerja, dan divisi dengan tabel relasional khusus.
- `monitor`: laporan perusahaan.

Komponen yang benar-benar lintas domain tetap berada di `components/`; utilitas
infrastruktur seperti auth, tenant context, dan object storage tetap di `lib/`.
