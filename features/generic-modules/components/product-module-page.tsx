"use client";

import Link from "next/link";
import type { Route } from "next";
import {
  AlertTriangle,
  BarChart3,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock3,
  CreditCard,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  LockKeyhole,
  MapPin,
  Pencil,
  Plus,
  ReceiptText,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  UploadCloud,
  UserRound,
  Users,
  WalletCards,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { isFeatureModule } from "@/features/generic-modules/config/feature-modules";

type Stat = { label: string; value: string; meta: string; tone?: "blue" | "green" | "orange" | "red" };
type FeatureRecord = { id: string; fields: Record<string, string>; status: string; createdBy: string; createdAt: string; updatedAt: string };
type FeaturePermissions = { write: boolean; manage: boolean; userId: string };
type ScreenConfig = {
  title: string;
  description: string;
  breadcrumb: string;
  action?: string;
  exportable?: boolean;
  columns: string[];
  rows: string[][];
  filters?: string[];
  stats?: Stat[];
  form?: string[];
};

const people = [
  ["AK", "Ardi Kurniawan", "Engineering", "Aktif"],
  ["NS", "Nadia Safitri", "Human Resource", "Aktif"],
  ["RF", "Rizky Fauzan", "Finance", "Aktif"],
  ["DA", "Dian Anggraini", "Operations", "Nonaktif"],
];

const screens: Record<string, ScreenConfig> = {
  pengumuman: {
    title: "Pengumuman",
    description: "Kelola informasi penting yang ditampilkan untuk seluruh karyawan.",
    breadcrumb: "Beranda / Pengumuman",
    action: "Tambah Pengumuman",
    columns: ["Pengumuman", "Tanggal Tayang", "Target", "Status", "Aksi"],
    rows: [
      ["Jadwal libur nasional", "21 Okt 2026", "Semua Karyawan", "Terbit", ""],
      ["Town hall kuartal IV", "18 Okt 2026", "Semua Divisi", "Terjadwal", ""],
      ["Pembaruan kebijakan cuti", "10 Okt 2026", "Human Resource", "Draft", ""],
    ],
    filters: ["Semua Status", "Bulan Ini"],
    form: ["Judul Pengumuman", "Deskripsi Singkat", "Deskripsi Pengumuman", "Gambar Sampul"],
  },
  "master/shift": {
    title: "Daftar Shift",
    description: "Atur kelompok jadwal dan toleransi keterlambatan.",
    breadcrumb: "Beranda / Master Data / Shift",
    action: "Tambah Shift",
    columns: ["Shift", "Toleransi Telat", "Karyawan", "Status", "Aksi"],
    rows: [
      ["Shift Pagi", "10 menit", "18 karyawan", "Aktif", ""],
      ["Shift Siang", "10 menit", "9 karyawan", "Aktif", ""],
      ["Shift Lapangan", "15 menit", "6 karyawan", "Aktif", ""],
    ],
    form: ["Nama Shift", "Toleransi Terlambat (menit)", "Status"],
  },
  "master/jam-kerja": {
    title: "Daftar Jam Kerja",
    description: "Tetapkan jam masuk dan pulang untuk setiap hari kerja.",
    breadcrumb: "Beranda / Master Data / Jam Kerja",
    action: "Atur Jam Kerja",
    columns: ["Shift", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Aksi"],
    rows: [
      ["Shift Pagi", "08:00â€“17:00", "08:00â€“17:00", "08:00â€“17:00", "08:00â€“17:00", "08:00â€“16:00", ""],
      ["Shift Siang", "12:00â€“20:00", "12:00â€“20:00", "12:00â€“20:00", "12:00â€“20:00", "12:00â€“20:00", ""],
      ["Shift Lapangan", "07:30â€“16:30", "07:30â€“16:30", "07:30â€“16:30", "07:30â€“16:30", "07:30â€“16:00", ""],
    ],
    filters: ["Semua Shift"],
    form: ["Pilih Shift", "Hari Kerja", "Jam Masuk", "Jam Pulang"],
  },
  "master/divisi": {
    title: "Daftar Divisi",
    description: "Kelola struktur divisi, shift, dan metode perhitungan gaji.",
    breadcrumb: "Beranda / Master Data / Divisi",
    action: "Tambah Divisi",
    columns: ["Nama Divisi", "Shift Divisi", "Perhitungan Gaji", "Karyawan", "Status", "Aksi"],
    rows: [
      ["Engineering", "Shift Pagi", "Bulanan", "12", "Aktif", ""],
      ["Operations", "Shift Lapangan", "Harian", "10", "Aktif", ""],
      ["Finance", "Shift Pagi", "Bulanan", "5", "Aktif", ""],
    ],
    filters: ["Semua Shift", "Semua Status"],
    form: ["Nama Divisi", "Shift Divisi", "Perhitungan Gaji", "Status"],
  },
  "master/jabatan": {
    title: "Daftar Jabatan",
    description: "Kelola jabatan yang digunakan pada profil karyawan.",
    breadcrumb: "Beranda / Master Data / Jabatan",
    action: "Tambah Jabatan",
    columns: ["Nama Jabatan", "Divisi", "Jumlah Karyawan", "Status", "Aksi"],
    rows: [
      ["Software Engineer", "Engineering", "8", "Aktif", ""],
      ["HR Specialist", "Human Resource", "3", "Aktif", ""],
      ["Finance Officer", "Finance", "4", "Aktif", ""],
    ],
    form: ["Nama Jabatan", "Divisi", "Status"],
  },
  "master/lokasi-presensi": {
    title: "Daftar Lokasi Presensi",
    description: "Tentukan titik dan radius lokasi yang sah untuk presensi.",
    breadcrumb: "Beranda / Master Data / Lokasi Presensi",
    action: "Tambah Lokasi",
    columns: ["Lokasi", "Alamat", "Radius", "Karyawan", "Status", "Aksi"],
    rows: [
      ["Kantor Utama", "Jl. Ahmad Yani No. 18", "100 meter", "24", "Aktif", ""],
      ["Gudang Timur", "Jl. Gatot Subroto No. 9", "150 meter", "8", "Aktif", ""],
      ["Kantor Cabang", "Jl. Veteran No. 45", "100 meter", "6", "Aktif", ""],
    ],
    form: ["Nama Lokasi", "Alamat", "Latitude", "Longitude", "Radius", "Karyawan"],
  },
  karyawan: {
    title: "Daftar Karyawan",
    description: "Kelola identitas, penempatan, dan status seluruh anggota tim.",
    breadcrumb: "Beranda / Karyawan / Daftar Karyawan",
    action: "Tambah Karyawan",
    exportable: true,
    columns: ["Karyawan", "Nomor Induk", "Jabatan / Divisi", "Lokasi Presensi", "Mulai Kerja", "Status", "Aksi"],
    rows: [
      ["Ardi Kurniawan", "EMP-001", "Software Engineer Â· Engineering", "Kantor Utama", "12 Jan 2024", "Aktif", ""],
      ["Nadia Safitri", "EMP-002", "HR Specialist Â· Human Resource", "Kantor Utama", "08 Mar 2024", "Aktif", ""],
      ["Rizky Fauzan", "EMP-003", "Finance Officer Â· Finance", "Kantor Utama", "19 Jun 2024", "Aktif", ""],
      ["Dian Anggraini", "EMP-004", "Field Officer Â· Operations", "Gudang Timur", "02 Sep 2024", "Nonaktif", ""],
    ],
    filters: ["Semua Divisi", "Semua Jabatan", "Semua Status"],
    stats: [
      { label: "Karyawan Aktif", value: "38", meta: "+3 bulan ini", tone: "blue" },
      { label: "Karyawan Baru", value: "3", meta: "30 hari terakhir", tone: "green" },
      { label: "Dalam Cuti", value: "2", meta: "hari ini", tone: "orange" },
      { label: "Nonaktif", value: "4", meta: "seluruh waktu", tone: "red" },
    ],
    form: ["Nama Karyawan", "Email", "Nomor Induk", "Divisi", "Jabatan", "Tanggal Mulai Kerja"],
  },
  "karyawan/gaji": {
    title: "Daftar Gaji Karyawan",
    description: "Atur gaji pokok, upah lembur, kompensasi, dan potongan.",
    breadcrumb: "Beranda / Karyawan / Daftar Gaji",
    action: "Batch Edit",
    columns: ["Karyawan", "Divisi", "Gaji Pokok", "Upah Lembur", "Kompensasi", "Potongan", "Aksi"],
    rows: [
      ["Ardi Kurniawan", "Engineering", "Rp 8.500.000", "Rp 50.000/jam", "Rp 750.000", "Rp 150.000", ""],
      ["Nadia Safitri", "Human Resource", "Rp 7.250.000", "Rp 45.000/jam", "Rp 600.000", "Rp 100.000", ""],
      ["Rizky Fauzan", "Finance", "Rp 7.800.000", "Rp 48.000/jam", "Rp 650.000", "Rp 125.000", ""],
    ],
    filters: ["Semua Divisi"],
    form: ["Pilih Divisi", "Upah Lembur", "Gaji Pokok", "Kompensasi", "Potongan"],
  },
  "karyawan/laporan-cuti": {
    title: "Laporan Cuti Karyawan",
    description: "Pantau penggunaan dan sisa hak cuti setiap karyawan.",
    breadcrumb: "Beranda / Karyawan / Laporan Cuti",
    exportable: true,
    columns: ["Karyawan", "Divisi", "Hak Cuti", "Terpakai", "Menunggu", "Sisa Cuti", "Status"],
    rows: [
      ["Ardi Kurniawan", "Engineering", "12 hari", "4 hari", "0 hari", "8 hari", "Tersedia"],
      ["Nadia Safitri", "Human Resource", "12 hari", "7 hari", "2 hari", "3 hari", "Terbatas"],
      ["Rizky Fauzan", "Finance", "12 hari", "2 hari", "0 hari", "10 hari", "Tersedia"],
    ],
    filters: ["2026", "Semua Divisi"],
    stats: [
      { label: "Total Hak Cuti", value: "372", meta: "hari pada tahun 2026", tone: "blue" },
      { label: "Cuti Terpakai", value: "96", meta: "25,8% dari total", tone: "green" },
      { label: "Menunggu", value: "12", meta: "hari belum diputuskan", tone: "orange" },
      { label: "Sisa Cuti", value: "264", meta: "hari tersedia", tone: "blue" },
    ],
  },
  "pengajuan/izin-cuti": requestScreen("Daftar Pengajuan Izin / Cuti", "Kelola permohonan izin, sakit, dan cuti karyawan.", ["Karyawan", "Jenis", "Periode", "Durasi", "Alasan", "Status", "Aksi"], [
    ["Nadia Safitri", "Cuti Tahunan", "21â€“22 Okt 2026", "2 hari", "Acara keluarga", "Menunggu", ""],
    ["Rizky Fauzan", "Sakit", "15 Okt 2026", "1 hari", "Pemulihan", "Disetujui", ""],
    ["Dian Anggraini", "Izin", "11 Okt 2026", "1 hari", "Keperluan pribadi", "Ditolak", ""],
  ], "Tambah Pengajuan"),
  "pengajuan/lembur": requestScreen("Daftar Pengajuan Lembur", "Tinjau durasi dan deskripsi lembur karyawan.", ["Karyawan", "Tanggal", "Jam Masukâ€“Keluar", "Durasi", "Deskripsi", "Status", "Aksi"], [
    ["Ardi Kurniawan", "18 Okt 2026", "17:30â€“20:30", "3 jam", "Deployment aplikasi", "Menunggu", ""],
    ["Dian Anggraini", "16 Okt 2026", "17:00â€“19:00", "2 jam", "Stock opname", "Disetujui", ""],
  ], "Tambah Lembur", ["Nama Karyawan", "Tanggal Lembur", "Jam", "Menit", "Deskripsi Lembur"]),
  "presensi/harian": {
    title: "Presensi Harian",
    description: "Pantau waktu masuk, pulang, dan status presensi hari ini.",
    breadcrumb: "Beranda / Presensi / Presensi Harian",
    action: "Tambah Presensi",
    exportable: true,
    columns: ["Karyawan", "Shift", "Jadwal", "Jam Masuk", "Jam Pulang", "Keterlambatan", "Status", "Aksi"],
    rows: [
      ["Ardi Kurniawan", "Shift Pagi", "08:00â€“17:00", "07:54", "17:06", "â€”", "Tepat Waktu", ""],
      ["Nadia Safitri", "Shift Pagi", "08:00â€“17:00", "08:07", "17:02", "â€”", "Tepat Waktu", ""],
      ["Rizky Fauzan", "Shift Pagi", "08:00â€“17:00", "08:24", "17:15", "14 menit", "Terlambat", ""],
      ["Dian Anggraini", "Shift Lapangan", "07:30â€“16:30", "â€”", "â€”", "â€”", "Izin", ""],
    ],
    filters: ["16 Okt 2026", "Semua Divisi", "Semua Status"],
    stats: [
      { label: "Total Karyawan", value: "38", meta: "karyawan aktif", tone: "blue" },
      { label: "Tepat Waktu", value: "29", meta: "76% dari total", tone: "green" },
      { label: "Terlambat", value: "5", meta: "perlu tindak lanjut", tone: "orange" },
      { label: "Izin / Cuti", value: "4", meta: "pengajuan disetujui", tone: "red" },
    ],
    form: ["Karyawan", "Tanggal", "Jam Masuk", "Jam Pulang", "Status", "Catatan"],
  },
  "presensi/bulanan": {
    title: "Laporan Presensi Bulanan",
    description: "Rekap kehadiran bulanan berdasarkan karyawan dan divisi.",
    breadcrumb: "Beranda / Presensi / Laporan Bulanan",
    exportable: true,
    columns: ["Karyawan", "Hari Kerja", "Hadir", "Tepat Waktu", "Terlambat", "Izin", "Cuti", "Absen"],
    rows: [
      ["Ardi Kurniawan", "22", "21", "19", "2", "0", "1", "0"],
      ["Nadia Safitri", "22", "20", "18", "2", "1", "1", "0"],
      ["Rizky Fauzan", "22", "22", "17", "5", "0", "0", "0"],
    ],
    filters: ["Oktober", "2026", "Semua Divisi", "Semua Shift"],
  },
  kunjungan: {
    title: "Daftar Kunjungan",
    description: "Atur jadwal kunjungan dan pantau aktivitas tim lapangan.",
    breadcrumb: "Beranda / Kunjungan / Daftar Kunjungan",
    action: "Tambah Kunjungan",
    columns: ["Karyawan", "Lokasi", "Tanggal", "Jadwal", "Check-in", "Status", "Aksi"],
    rows: [
      ["Dian Anggraini", "Mitra Sejahtera", "18 Okt 2026", "09:00", "08:56", "Selesai", ""],
      ["Ardi Kurniawan", "Cabang Utara", "20 Okt 2026", "10:00", "â€”", "Terjadwal", ""],
      ["Nadia Safitri", "Toko Sentosa", "21 Okt 2026", "13:30", "â€”", "Terjadwal", ""],
    ],
    filters: ["Bulan Ini", "Semua Status"],
    form: ["Tanggal Kunjungan", "Karyawan", "Lokasi", "Jam", "Catatan"],
  },
  "kunjungan/laporan": {
    title: "Laporan Kunjungan",
    description: "Analisis aktivitas dan hasil kunjungan tim lapangan.",
    breadcrumb: "Beranda / Kunjungan / Laporan",
    exportable: true,
    columns: ["Karyawan", "Lokasi", "Tanggal", "Masuk", "Keluar", "Durasi", "Jarak", "Status"],
    rows: [
      ["Dian Anggraini", "Mitra Sejahtera", "18 Okt 2026", "08:56", "10:22", "1j 26m", "18 m", "Selesai"],
      ["Ardi Kurniawan", "Toko Sentosa", "14 Okt 2026", "13:05", "14:40", "1j 35m", "9 m", "Selesai"],
      ["Rizky Fauzan", "Cabang Utara", "09 Okt 2026", "10:21", "â€”", "â€”", "142 m", "Tidak Lengkap"],
    ],
    filters: ["Oktober", "2026", "Semua Karyawan", "Semua Lokasi"],
  },
  "pengaturan/users": {
    title: "Daftar User",
    description: "Kelola pengguna yang dapat mengakses ruang kerja perusahaan.",
    breadcrumb: "Beranda / Pengaturan / User Login",
    action: "Tambah User",
    columns: ["User", "Email", "User Level", "Login Terakhir", "Status", "OTP Login", "Aksi"],
    rows: [
      ["Administrator", "admin@tepatwaktu.id", "Admin Perusahaan", "Hari ini, 08:12", "Aktif", "Aktif", ""],
      ["Bima Nugraha", "bima@tepatwaktu.id", "General Manager", "Hari ini, 07:52", "Aktif", "Aktif", ""],
      ["Nadia Safitri", "nadia@tepatwaktu.id", "HRD", "Kemarin, 17:44", "Aktif", "Nonaktif", ""],
      ["Rizky Fauzan", "rizky@tepatwaktu.id", "Manager", "14 Okt, 09:16", "Aktif", "Aktif", ""],
      ["Dian Anggraini", "dian@tepatwaktu.id", "Karyawan / Staf", "14 Okt, 08:01", "Aktif", "Nonaktif", ""],
    ],
    filters: ["Semua Level", "Semua Status"],
    form: ["Nama User", "Email", "User Level", "Divisi", "Password Sementara"],
  },
  "pengaturan/roles": {
    title: "Role & Hak Akses",
    description: "Atur batas akses setiap role di dalam perusahaan aktif.",
    breadcrumb: "Beranda / Pengaturan / Role & Hak Akses",
    columns: ["Role", "Cakupan", "Akses Utama", "Batasan", "Pengguna", "Aksi"],
    rows: [
      ["Admin Perusahaan", "1 perusahaan", "Seluruh modul perusahaan", "Tidak dapat mengakses perusahaan lain", "1", ""],
      ["General Manager", "1 perusahaan", "Monitor, laporan, persetujuan", "Tanpa pengaturan platform", "1", ""],
      ["HRD", "1 perusahaan", "Karyawan dan presensi", "Tanpa billing dan pengaturan platform", "3", ""],
      ["Manager", "Divisi / tim", "Tim, presensi, persetujuan", "Hanya divisi yang ditugaskan", "4", ""],
      ["Karyawan / Staf", "Data pribadi", "Presensi dan pengajuan sendiri", "Tidak dapat melihat data karyawan lain", "29", ""],
    ],
  },
  "pengaturan/ip-whitelist": {
    title: "Daftar IP Whitelist",
    description: "Batasi akses admin panel dari alamat jaringan yang dipercaya.",
    breadcrumb: "Beranda / Pengaturan / IP Whitelist",
    action: "Tambah IP Whitelist",
    columns: ["Alamat IP / CIDR", "Keterangan", "Tanggal Dibuat", "Dibuat Oleh", "Status", "Aksi"],
    rows: [
      ["103.144.22.18", "Kantor Utama", "12 Okt 2026", "Administrator", "Aktif", ""],
      ["36.88.0.0/16", "VPN Perusahaan", "08 Okt 2026", "Administrator", "Aktif", ""],
    ],
    form: ["Alamat IP atau CIDR", "Keterangan", "Status"],
  },
};

export function ProductModulePage({ slug }: { slug: string }) {
  if (slug === "monitor") return <MonitorPage />;
  if (slug === "karyawan/tambah") return <EmployeeFormPage />;
  if (slug === "pengaturan/profile") return <ProfilePage />;
  if (slug === "pengaturan/aplikasi") return <ApplicationSettingsPage />;
  if (slug === "langganan") return <SubscriptionPage />;
  if (slug === "langganan/paket") return <PlansPage />;
  if (slug === "langganan/checkout") return <SubscriptionCheckoutPage />;
  if (slug === "langganan/pembayaran/berhasil") return <PaymentResultPage success />;
  if (slug === "langganan/pembayaran/gagal") return <PaymentResultPage success={false} />;

  const config = screens[slug];
  if (!config) return <MissingPage slug={slug} />;
  return <ListPage config={config} slug={slug} />;
}

export function FeatureDetailPage({ module, id }: { module: string; id: string }) {
  if (isFeatureModule(module)) return <LiveFeatureDetail module={module} id={id} />;
  if (module === "langganan") return <InvoiceDetailPage id={id} />;

  const config = screens[module];
  const title = config?.title.replace(/^Daftar\s+/, "") ?? productScreenTitle(module);
  const row = config?.rows[0] ?? ["Data Utama", "Informasi", "Aktif"];
  const requestDetail = module.startsWith("pengajuan/");
  const employeeDetail = module === "karyawan";

  return (
    <>
      <PageHeader
        title={`Detail ${title}`}
        description={`Informasi lengkap, aktivitas, dan dokumen terkait ${title.toLowerCase()}.`}
        breadcrumb={`Beranda / ${title} / Detail`}
        actions={
          <>
            <Link className="btn btn-outline btn-compact" href={`/dashboard/${module}` as Route}>Kembali</Link>
            <button className="btn btn-primary btn-compact"><Pencil size={15} />Ubah Data</button>
          </>
        }
      />

      <section className="detail-hero module-card">
        <div className="detail-identity">
          <span className="detail-avatar">{employeeDetail ? "AK" : title.slice(0, 2).toUpperCase()}</span>
          <div><span className="eyebrow">ID Â· {id.toUpperCase()}</span><h2>{row[0]}</h2><p>{row[1] ?? "Data tercatat pada ruang kerja utama"}</p></div>
        </div>
        <StatusPill value={row.find(isStatus) ?? "Aktif"} />
      </section>

      <div className="detail-layout">
        <div className="detail-main">
          <section className="module-card detail-section">
            <div className="detail-section-head"><div><FileText size={17} /><h2>Informasi Utama</h2></div><span>Terakhir diperbarui hari ini</span></div>
            <div className="detail-grid">
              {(config?.columns ?? ["Nama", "Keterangan", "Status"]).filter((column) => column !== "Aksi").map((column, index) => (
                <div className="detail-field" key={column}><small>{column}</small><strong>{row[index] || "â€”"}</strong></div>
              ))}
            </div>
          </section>

          {employeeDetail ? <EmployeeDetailSections /> : null}
          {requestDetail ? <RequestDetailSections /> : null}

          <section className="module-card detail-section">
            <div className="detail-section-head"><div><FileText size={17} /><h2>Catatan & Lampiran</h2></div><button className="text-action">Tambah Catatan</button></div>
            <div className="attachment-list">
              <div><span className="attachment-icon"><FileText size={17} /></span><span><strong>Dokumen pendukung.pdf</strong><small>PDF Â· 284 KB Â· diunggah 16 Okt 2026</small></span><button><Download size={15} /></button></div>
              <div><span className="attachment-icon image"><ImageIconFallback /></span><span><strong>Bukti dokumentasi.jpg</strong><small>JPG Â· 1,2 MB Â· diunggah 16 Okt 2026</small></span><button><Eye size={15} /></button></div>
            </div>
          </section>
        </div>

        <aside className="detail-side">
          {requestDetail ? <section className="module-card detail-action-card"><span className="eyebrow">TINDAKAN</span><h2>Keputusan Pengajuan</h2><p>Pastikan data dan lampiran telah diperiksa sebelum mengambil keputusan.</p><button className="btn btn-primary btn-block"><Check size={15} />Setujui</button><button className="btn btn-danger btn-block"><X size={15} />Tolak Pengajuan</button></section> : null}
          <section className="module-card timeline-card">
            <div className="detail-section-head"><div><Clock3 size={17} /><h2>Riwayat Aktivitas</h2></div></div>
            <ol className="activity-timeline">
              <li><i className="green" /><div><strong>Data diperbarui</strong><span>Administrator Â· Hari ini, 09:42</span><p>Informasi utama berhasil diperbarui.</p></div></li>
              <li><i className="blue" /><div><strong>Data ditinjau</strong><span>Nadia Safitri Â· Kemarin, 15:18</span><p>Pemeriksaan dokumen telah selesai.</p></div></li>
              <li><i /><div><strong>Data dibuat</strong><span>Administrator Â· 12 Okt 2026</span><p>Record pertama kali ditambahkan.</p></div></li>
            </ol>
          </section>
          <section className="module-card audit-mini"><ShieldCheck size={18} /><div><strong>Audit tercatat</strong><span>Semua perubahan pada data ini disimpan dalam audit log.</span></div></section>
        </aside>
      </div>
    </>
  );
}

function LiveFeatureDetail({ module, id }: { module: string; id: string }) {
  const [record, setRecord] = useState<FeatureRecord | null>(null);
  const [permissions, setPermissions] = useState<FeaturePermissions>({ write: false, manage: false, userId: "" });
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const config = screens[module];
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/feature-records/${encodeURIComponent(id)}?module=${encodeURIComponent(module)}`, { cache: "no-store" })
      .then(async (response) => { const body = await response.json(); if (!response.ok) throw new Error(body.error ?? "Data tidak ditemukan."); if (!cancelled) { setRecord(body.record); setPermissions(body.permissions); } })
      .catch((cause) => { if (!cancelled) setError(cause instanceof Error ? cause.message : "Data tidak ditemukan."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id, module]);

  async function update(fields: Record<string, string>, status?: string) {
    const response = await fetch(`/api/feature-records/${record?.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ module, fields, status }) });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error ?? "Perubahan gagal disimpan.");
    setRecord(body.record); setEditing(false); setError("");
  }
  async function changeStatus(status: string) {
    try { await update({}, status); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Status gagal diperbarui."); }
  }

  if (loading) return <div className="empty-state">Memuat detail...</div>;
  if (!record) return <div className="empty-state"><AlertTriangle size={28} /><strong>Data tidak tersedia</strong><span>{error}</span><Link className="btn btn-outline" href={`/dashboard/${module}` as Route}>Kembali</Link></div>;
  const title = config?.title.replace(/^Daftar\s+/, "") ?? productScreenTitle(module);
  return <>
    <PageHeader title={`Detail ${title}`} description="Rincian data tersimpan untuk perusahaan aktif." breadcrumb={`Beranda / ${title} / Detail`} actions={<><Link className="btn btn-outline btn-compact" href={`/dashboard/${module}` as Route}>Kembali</Link>{permissions.write && (permissions.manage || permissions.userId === record.createdBy) ? <button className="btn btn-primary btn-compact" onClick={() => setEditing(true)}><Pencil size={15} /> Ubah Data</button> : null}</>} />
    {error ? <div className="error-box" role="alert">{error}</div> : null}
    <section className="detail-hero module-card"><div className="detail-identity"><span className="detail-avatar">{title.slice(0, 2).toUpperCase()}</span><div><span className="eyebrow">ID Â· {record.id}</span><h2>{Object.values(record.fields)[0] || title}</h2><p>Dibuat {new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(record.createdAt))}</p></div></div><StatusPill value={record.status} /></section>
    <section className="detail-layout"><div className="detail-main"><div className="module-card detail-section"><div className="detail-section-head"><div><FileText size={17} /><h2>Informasi Utama</h2></div></div><div className="detail-grid">{Object.entries(record.fields).map(([label, value]) => <div className="detail-field" key={label}><small>{label}</small><strong>{value.startsWith("/api/files/") ? <a className="text-link" href={value} target="_blank" rel="noreferrer">Buka lampiran</a> : value || "â€”"}</strong></div>)}</div></div></div>
      <aside className="detail-side"><section className="module-card detail-action-card"><span className="eyebrow">STATUS</span><h2>{record.status}</h2><p>Terakhir diperbarui {new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(record.updatedAt))}.</p>{permissions.manage && module.startsWith("pengajuan/") && record.status === "Menunggu" ? <><button className="btn btn-primary btn-block" onClick={() => void changeStatus("Disetujui")}>Setujui</button><button className="btn btn-danger btn-block" onClick={() => void changeStatus("Ditolak")}>Tolak</button></> : null}</section></aside>
    </section>
    {editing ? <DemoModal module={module} title="Ubah Data" fields={config?.form ?? Object.keys(record.fields)} initial={record.fields} onSave={(fields) => update(fields)} onClose={() => setEditing(false)} /> : null}
  </>;
}

export function hasProductScreen(slug: string) {
  return Boolean(screens[slug]) || [
    "monitor",
    "karyawan/tambah",
    "pengaturan/profile",
    "pengaturan/aplikasi",
    "langganan",
    "langganan/paket",
    "langganan/checkout",
    "langganan/pembayaran/berhasil",
    "langganan/pembayaran/gagal",
  ].includes(slug);
}

export function productScreenTitle(slug: string) {
  if (screens[slug]) return screens[slug].title;
  const names: Record<string, string> = {
    monitor: "Monitor Perusahaan",
    "karyawan/tambah": "Tambah Karyawan",
    "pengaturan/profile": "Profile",
    "pengaturan/aplikasi": "Pengaturan Aplikasi",
    langganan: "Langganan",
    "langganan/paket": "Daftar Paket",
    "langganan/checkout": "Checkout Langganan",
    "langganan/pembayaran/berhasil": "Pembayaran Berhasil",
    "langganan/pembayaran/gagal": "Pembayaran Gagal",
  };
  return names[slug] ?? "TepatWaktu";
}

function ListPage({ config, slug }: { config: ScreenConfig; slug: string }) {
  const [query, setQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [records, setRecords] = useState<FeatureRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<FeatureRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FeatureRecord | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");
  const [permissions, setPermissions] = useState<FeaturePermissions>({ write: false, manage: false, userId: "" });
  const isBacked = isFeatureModule(slug);

  useEffect(() => {
    if (!isBacked) return;
    let cancelled = false;
    fetch(`/api/feature-records?module=${encodeURIComponent(slug)}`, { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error ?? "Data tidak dapat dimuat.");
        if (!cancelled) { setRecords(body.rows); setPermissions(body.permissions); }
      })
      .catch((cause) => { if (!cancelled) setError(cause instanceof Error ? cause.message : "Data tidak dapat dimuat."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [slug, isBacked]);

  const visibleRows = useMemo(() => records.filter((record) => {
    const matchesQuery = !query.trim() || `${Object.values(record.fields).join(" ")} ${record.status}`.toLowerCase().includes(query.toLowerCase());
    return matchesQuery && (!statusFilter || record.status === statusFilter);
  }), [records, query, statusFilter]);

  async function save(fields: Record<string, string>) {
    const response = await fetch(editing ? `/api/feature-records/${editing.id}` : "/api/feature-records", {
      method: editing ? "PATCH" : "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ module: slug, fields, status: fields.Status || undefined }),
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error ?? "Gagal menyimpan data.");
    setRecords((current) => editing ? current.map((record) => record.id === editing.id ? body.record : record) : [body.record, ...current]);
    setEditing(null);
    setModalOpen(false);
  }

  async function remove() {
    if (!deleteTarget) return;
    setDeleting(true);
    const response = await fetch(`/api/feature-records/${deleteTarget.id}?module=${encodeURIComponent(slug)}`, { method: "DELETE" });
    const body = await response.json();
    if (!response.ok) { setError(body.error ?? "Gagal menghapus data."); setDeleting(false); return; }
    setRecords((current) => current.filter((item) => item.id !== deleteTarget.id));
    setDeleteTarget(null);
    setDeleting(false);
  }

  return (
    <>
      <PageHeader title={config.title} description={config.description} breadcrumb={config.breadcrumb} />
      {error ? <div className="error-box" role="alert">{error}</div> : null}
      <section className="module-card">
        <div className="module-toolbar">
          <div className="toolbar-primary">
            <label className="search-control">
              <Search size={16} />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari data..." />
            </label>
            <select className="filter-control" aria-label="Filter status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="">Semua status</option>{Array.from(new Set(records.map((record) => record.status))).map((status) => <option value={status} key={status}>{status}</option>)}</select>
            <button className="btn btn-filter" onClick={() => { setQuery(""); setStatusFilter(""); }}><SlidersHorizontal size={15} /> Reset Filter</button>
          </div>
          <div className="toolbar-actions">
            {config.exportable ? <button className="btn btn-outline btn-compact" onClick={() => downloadCsv(config.columns, visibleRows, slug)}><Download size={15} /> Ekspor CSV</button> : null}
            {config.action && isBacked && permissions.write ? <button className="btn btn-primary btn-compact" onClick={() => { setEditing(null); setModalOpen(true); }}><Plus size={16} />{config.action}</button> : null}
          </div>
        </div>

        <div className="data-table-wrap">
          <table className="data-table">
            <thead><tr>{config.columns.map((column) => <th key={column}>{column}</th>)}</tr></thead>
            <tbody>
              {visibleRows.map((record, rowIndex) => (
                <tr key={record.id}>
                  {config.columns.map((column, columnIndex) => (
                    <td key={column}>{column === "Aksi" ? <span className="row-actions"><Link href={`/dashboard/${slug}/${record.id}` as Route} title="Lihat"><Eye size={15} /></Link>{permissions.write && (permissions.manage || permissions.userId === record.createdBy) ? <button title="Ubah" onClick={() => { setEditing(record); setModalOpen(true); }}><Pencil size={15} /></button> : null}{permissions.manage ? <button title="Hapus" onClick={() => setDeleteTarget(record)}><Trash2 size={15} /></button> : null}</span> : column === "#" ? rowIndex + 1 : /status/i.test(column) ? <StatusPill value={record.status} /> : displayValue(record, column, columnIndex, config.form)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {loading ? <div className="empty-state modern"><span>Memuat data...</span></div> : !visibleRows.length ? <EmptyState /> : null}
        </div>

        <div className="table-footer">
          <span>Menampilkan {visibleRows.length} dari {records.length} data</span>
        </div>
      </section>

      {modalOpen ? <DemoModal module={slug} title={editing ? "Ubah Data" : config.action ?? "Tambah Data"} fields={config.form ?? ["Nama", "Keterangan", "Status"]} initial={editing?.fields} onSave={save} onClose={() => { setModalOpen(false); setEditing(null); }} /> : null}
      <ConfirmDialog open={Boolean(deleteTarget)} message="Data ini akan dihapus permanen dan tidak dapat dipulihkan." busy={deleting} onCancel={() => setDeleteTarget(null)} onConfirm={remove}/>
    </>
  );
}

function MonitorPage() {
  const months = [42, 58, 49, 72, 64, 83, 76, 91, 86, 94, 88, 96];
  return (
    <>
      <PageHeader title="Monitor Perusahaan" description="Ringkasan performa kehadiran dan kapasitas tim." breadcrumb="Beranda / Monitor Perusahaan" />
      <div className="monitor-filters"><span>Periode laporan</span><button className="filter-control">Oktober <ChevronDownMini /></button><button className="filter-control">2026 <ChevronDownMini /></button><button className="btn btn-outline btn-compact">Terapkan</button></div>
      <StatsGrid stats={[
        { label: "Total Karyawan", value: "38", meta: "+3 bulan ini", tone: "blue" },
        { label: "Tepat Waktu", value: "82%", meta: "+4,2% dari September", tone: "green" },
        { label: "Terlambat", value: "7,4%", meta: "turun 1,8%", tone: "orange" },
        { label: "Izin / Cuti", value: "10,6%", meta: "12 pengajuan", tone: "red" },
      ]} />
      <div className="analytics-grid">
        <section className="module-card chart-card">
          <div className="card-heading-row"><div><span className="eyebrow">KEHADIRAN 12 BULAN</span><h2>Tren kehadiran perusahaan</h2></div><span className="trend-up">+8,4%</span></div>
          <div className="bar-chart" aria-label="Grafik kehadiran bulanan">
            {months.map((value, index) => <div className="bar-column" key={index}><i style={{ height: `${value}%` }} /><small>{["Nov", "Des", "Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt"][index]}</small></div>)}
          </div>
        </section>
        <section className="module-card capacity-card">
          <div className="card-heading-row"><div><span className="eyebrow">KAPASITAS PAKET</span><h2>Limit karyawan</h2></div><Users size={20} /></div>
          <div className="capacity-ring"><strong>38</strong><span>dari 50</span></div>
          <div className="meter"><i style={{ width: "76%" }} /></div>
          <p>Masih tersedia <strong>12 slot</strong> karyawan pada paket saat ini.</p>
        </section>
      </div>
      <div className="analytics-grid bottom">
        <RankingCard title="5 Karyawan Paling Tepat Waktu" tone="green" names={["Nadia Safitri", "Ardi Kurniawan", "Bagus Pratama", "Rizky Fauzan", "Citra Lestari"]} />
        <RankingCard title="5 Karyawan Terlambat Teratas" tone="orange" names={["Dian Anggraini", "Fajar Nugroho", "Intan Permata", "Bayu Saputra", "Rina Kartika"]} />
      </div>
    </>
  );
}

function EmployeeFormPage() {
  const uploads = ["Foto Karyawan", "Foto Selfie", "Foto KTP", "Ijazah & Sertifikat"];
  return (
    <>
      <PageHeader title="Tambah Karyawan" description="Lengkapi data personal dan pekerjaan karyawan baru." breadcrumb="Beranda / Karyawan / Tambah Karyawan" actions={<><Link href="/dashboard/karyawan" className="btn btn-outline btn-compact">Batalkan</Link><button className="btn btn-primary btn-compact"><Check size={16} />Simpan Karyawan</button></>} />
      <section className="module-card employee-form-card">
        <div className="form-section-head"><div><span>01</span><div><h2>Dokumen Karyawan</h2><p>Unggah foto dan dokumen pendukung.</p></div></div></div>
        <div className="upload-grid">
          {uploads.map((item) => <button className="upload-tile" key={item}><UploadCloud size={24} /><strong>{item}</strong><small>PNG, JPG, atau PDF Â· Maks. 5 MB</small><span>Cari File</span></button>)}
        </div>
        <div className="form-divider" />
        <div className="form-section-head"><div><span>02</span><div><h2>Informasi Personal</h2><p>Data identitas dan kontak karyawan.</p></div></div></div>
        <div className="wide-form-grid">
          {[
            ["Nama Karyawan", "Masukkan nama lengkap"], ["Nomor Induk Karyawan", "Contoh: EMP-001"], ["Email", "nama@perusahaan.com"], ["No. Handphone", "08xx xxxx xxxx"],
            ["Tanggal Lahir", "dd/mm/yyyy"], ["Jenis Kelamin", "Pilih jenis kelamin"], ["Alamat", "Masukkan alamat lengkap"], ["NPWP (Opsional)", "Nomor Pokok Wajib Pajak"], ["No. BPJS (Opsional)", "Nomor BPJS"],
          ].map(([label, placeholder], index) => <Field label={label} placeholder={placeholder} full={index === 6} key={label} />)}
        </div>
        <div className="form-divider" />
        <div className="form-section-head"><div><span>03</span><div><h2>Informasi Pekerjaan</h2><p>Penempatan dan akses presensi.</p></div></div></div>
        <div className="wide-form-grid">
          <Field label="Tanggal Mulai Kerja" placeholder="dd/mm/yyyy" />
          <Field label="Divisi Karyawan" placeholder="Pilih divisi" select />
          <Field label="Jabatan Karyawan" placeholder="Pilih jabatan" select />
          <Field label="Shift Karyawan" placeholder="Pilih shift" select />
          <Field label="Lokasi Presensi" placeholder="Semua lokasi perusahaan" select full />
        </div>
      </section>
    </>
  );
}

function ApplicationSettingsPage() {
  const menuItems = ["Istirahat", "Laporan", "Kunjungan", "Tugas", "Lembur", "Izin"];
  return (
    <>
      <PageHeader title="Pengaturan Aplikasi" description="Sesuaikan pengalaman aplikasi untuk seluruh karyawan." breadcrumb="Beranda / Pengaturan / Aplikasi" actions={<button className="btn btn-primary btn-compact"><Check size={16} />Simpan Perubahan</button>} />
      <section className="module-card settings-panel standalone">
        <SettingsSection title="Kata Sapaan" description="Gunakan token $nama untuk menampilkan nama lengkap karyawan.">
          <div className="wide-form-grid"><Field label="Kalimat Sapaan" placeholder="Halo ðŸ‘‹ $nama" /><Field label="Kalimat Kutipan" placeholder="Semangat kerja hari ini!" /></div>
        </SettingsSection>
        <SettingsSection title="Menu Halaman Depan" description="Pilih menu yang tersedia pada aplikasi karyawan.">
          <div className="toggle-grid">{menuItems.map((item) => <ToggleRow label={item} description={`Tampilkan menu ${item.toLowerCase()}`} enabled key={item} />)}</div>
        </SettingsSection>
        <SettingsSection title="Verifikasi Akses" description="Tambahkan pemeriksaan ekstra sebelum pengguna membuka aplikasi.">
          <ToggleRow label="Aktifkan verifikasi akses" description="Pengguna baru perlu diverifikasi administrator." enabled={false} />
        </SettingsSection>
      </section>
    </>
  );
}

function ProfilePage() {
  return (
    <>
      <PageHeader title="Profile" description="Kelola informasi akun dan keamanan login Anda." breadcrumb="Beranda / Pengaturan / Profile" />
      <div className="profile-layout">
        <aside className="module-card profile-summary">
          <div className="profile-avatar">AR</div><h2>Admin Ruang Kerja</h2><p>admin@tepatwaktu.id</p><span className="role-pill">Owner</span>
          <div className="plan-mini"><small>Paket Aktif</small><strong>Basic+</strong><span>38 dari 50 karyawan</span><div className="meter"><i style={{ width: "76%" }} /></div></div>
        </aside>
        <section className="module-card profile-form">
          <div className="profile-tabs"><button className="active">Profil Akun</button><button>Perusahaan</button><button>Reset Password</button></div>
          <div className="wide-form-grid"><Field label="Nama Lengkap" placeholder="Admin Ruang Kerja" /><Field label="Email" placeholder="admin@tepatwaktu.id" /><Field label="No. Handphone" placeholder="0812 3456 7890" /><Field label="Zona Waktu" placeholder="Asia/Makassar" select /></div>
          <div className="action-row"><button className="btn btn-primary btn-compact">Simpan Profil</button></div>
        </section>
      </div>
    </>
  );
}

function SubscriptionPage() {
  const [invoice, setInvoice] = useState(false);
  return (
    <>
      <PageHeader title="Langganan" description="Kelola paket, kapasitas, dan riwayat pembayaran perusahaan." breadcrumb="Beranda / Langganan" actions={<Link href={"/dashboard/langganan/paket" as Route} className="btn btn-primary btn-compact">Lihat Semua Paket</Link>} />
      <section className="subscription-hero">
        <div><span className="plan-label">PAKET AKTIF</span><h2>Basic+</h2><p>Akses seluruh fitur premium untuk tim berkembang.</p><div className="subscription-meta"><span><small>Aktif sampai</small><strong>16 November 2026</strong></span><span><small>Tagihan berikutnya</small><strong>Rp 60.000</strong></span></div></div>
        <div className="usage-panel"><span>Penggunaan karyawan</span><strong>38 <small>/ 50</small></strong><div className="meter"><i style={{ width: "76%" }} /></div><p>12 slot masih tersedia</p></div>
      </section>
      <section className="module-card">
        <div className="card-heading-row"><div><span className="eyebrow">RIWAYAT TRANSAKSI</span><h2>Invoice langganan</h2></div><button className="btn btn-outline btn-compact"><Download size={15} />Unduh Laporan</button></div>
        <div className="data-table-wrap"><table className="data-table"><thead><tr><th>No. Invoice</th><th>Tanggal</th><th>Paket</th><th>Periode</th><th>Total</th><th>Status</th><th>Aksi</th></tr></thead><tbody>
          <tr><td>#INV-10261</td><td>16 Okt 2026</td><td>Basic+</td><td>1 bulan</td><td>Rp 60.000</td><td><StatusPill value="Menunggu Pembayaran" /></td><td><button className="btn btn-primary btn-xs" onClick={() => setInvoice(true)}>Bayar</button></td></tr>
          <tr><td>#INV-09219</td><td>16 Sep 2026</td><td>Basic+</td><td>1 bulan</td><td>Rp 60.000</td><td><StatusPill value="Lunas" /></td><td><Link className="text-action" href={"/dashboard/langganan/invoice/inv-09219" as Route}>Detail</Link></td></tr>
          <tr><td>#INV-08178</td><td>16 Agu 2026</td><td>Basic</td><td>1 bulan</td><td>Rp 36.000</td><td><StatusPill value="Lunas" /></td><td><Link className="text-action" href={"/dashboard/langganan/invoice/inv-08178" as Route}>Detail</Link></td></tr>
        </tbody></table></div>
      </section>
      {invoice ? <InvoiceModal onClose={() => setInvoice(false)} /> : null}
    </>
  );
}

function PlansPage() {
  const plans = [
    ["Free", "Rp 0", "5", "Presensi dasar", "Laporan harian"],
    ["Basic", "Rp 36.000", "15", "Semua fitur Free", "Pengajuan karyawan"],
    ["Basic+", "Rp 60.000", "50", "Fitur premium", "Kunjungan"],
    ["Silver", "Rp 137.000", "75", "Semua fitur Basic+", "Kontrol akses"],
    ["Gold", "Rp 165.000", "100", "Semua fitur Silver", "Laporan lanjutan"],
    ["Platinum", "Rp 253.000", "125", "Semua fitur Gold", "Prioritas dukungan"],
  ];
  return (
    <>
      <PageHeader title="Daftar Paket" description="Pilih kapasitas dan fitur yang paling sesuai untuk perusahaan." breadcrumb="Beranda / Langganan / Daftar Paket" actions={<Link href={"/dashboard/langganan" as Route} className="btn btn-outline btn-compact">Kembali ke Langganan</Link>} />
      <div className="billing-toggle"><button className="active">Bulanan</button><button>Tahunan <span>Hemat 15%</span></button></div>
      <section className="plans-grid">
        {plans.map((plan, index) => <article className={`plan-card ${index === 2 ? "featured" : ""}`} key={plan[0]}>{index === 2 ? <span className="recommended">PAKET SAAT INI</span> : null}<div className="plan-icon"><WalletCards size={21} /></div><h2>{plan[0]}</h2><div className="plan-price"><strong>{plan[1]}</strong><span>/ bulan</span></div><p>Maksimal <strong>{plan[2]} karyawan</strong></p><ul><li><Check size={14} />{plan[3]}</li><li><Check size={14} />{plan[4]}</li><li><Check size={14} />Dashboard perusahaan</li></ul>{index === 2 ? <button className="btn btn-outline btn-block">Paket Aktif</button> : <Link href={"/dashboard/langganan/checkout" as Route} className="btn btn-primary btn-block">Pilih Paket</Link>}</article>)}
      </section>
    </>
  );
}

function SubscriptionCheckoutPage() {
  const [method, setMethod] = useState("Virtual Account");
  return <>
    <PageHeader title="Konfirmasi Langganan" description="Periksa paket dan metode pembayaran sebelum melanjutkan." breadcrumb="Beranda / Langganan / Checkout" actions={<Link href={"/dashboard/langganan/paket" as Route} className="btn btn-outline btn-compact">Pilih Paket Lain</Link>} />
    <div className="checkout-layout">
      <section className="module-card checkout-main"><div className="checkout-plan"><div className="plan-icon"><WalletCards size={22} /></div><div><span className="eyebrow">PAKET PILIHAN</span><h2>Silver</h2><p>Maksimal 75 karyawan Â· Seluruh fitur premium</p></div><strong>Rp 137.000<small>/bulan</small></strong></div><div className="checkout-section"><h3>Durasi langganan</h3><div className="duration-options"><button className="active"><strong>1 Bulan</strong><span>Rp 137.000</span></button><button><strong>6 Bulan</strong><span>Hemat 5%</span></button><button><strong>12 Bulan</strong><span>Hemat 15%</span></button></div></div><div className="checkout-section"><h3>Metode pembayaran</h3><div className="payment-options">{["Virtual Account", "QRIS", "E-Wallet"].map((item) => <button className={method === item ? "active" : ""} onClick={() => setMethod(item)} key={item}><CreditCard size={18} /><span><strong>{item}</strong><small>Konfirmasi otomatis</small></span><i>{method === item ? "âœ“" : ""}</i></button>)}</div></div></section>
      <aside className="module-card checkout-summary"><span className="eyebrow">RINGKASAN PESANAN</span><h2>Paket Silver</h2><div><span>Harga paket <strong>Rp 137.000</strong></span><span>Durasi <strong>1 bulan</strong></span><span>Biaya admin <strong>Rp 0</strong></span><span className="total">Total <strong>Rp 137.000</strong></span></div><Link href={"/dashboard/langganan/pembayaran/berhasil" as Route} className="btn btn-primary btn-block"><LockKeyhole size={15} />Bayar Sekarang</Link><p><ShieldCheck size={14} />Pembayaran diproses melalui koneksi aman.</p></aside>
    </div>
  </>;
}

function PaymentResultPage({ success }: { success: boolean }) {
  return <div className="payment-result-wrap"><section className={`module-card payment-result ${success ? "success" : "failed"}`}><div className="result-icon">{success ? <CheckCircle2 size={38} /> : <AlertTriangle size={38} />}</div><span className="eyebrow">STATUS PEMBAYARAN</span><h1>{success ? "Pembayaran berhasil" : "Pembayaran belum berhasil"}</h1><p>{success ? "Paket Silver telah aktif dan kapasitas perusahaan sudah diperbarui." : "Transaksi tidak dapat diproses. Silakan periksa metode pembayaran atau coba kembali."}</p><div className="result-reference"><span>No. Invoice <strong>#INV-10282</strong></span><span>Total Pembayaran <strong>Rp 137.000</strong></span><span>Waktu <strong>16 Okt 2026 Â· 10:24 WITA</strong></span></div><div className="result-actions">{success ? <><Link href={"/dashboard/langganan/invoice/inv-10282" as Route} className="btn btn-outline">Lihat Invoice</Link><Link href={"/dashboard/langganan" as Route} className="btn btn-primary">Kembali ke Langganan</Link></> : <><Link href={"/dashboard/langganan/paket" as Route} className="btn btn-outline">Ubah Paket</Link><Link href={"/dashboard/langganan/checkout" as Route} className="btn btn-primary">Coba Lagi</Link></>}</div></section></div>;
}

function PageHeader({ title, description, breadcrumb, actions }: { title: string; description: string; breadcrumb: string; actions?: React.ReactNode }) {
  return <header className="product-page-header"><div><span className="breadcrumb">{breadcrumb}</span><h1>{title}</h1><p>{description}</p></div>{actions ? <div className="page-actions">{actions}</div> : null}</header>;
}

function StatsGrid({ stats }: { stats: Stat[] }) {
  const icons = [Users, CheckCircle2, Clock3, FileText];
  return <section className="stats-grid product-stats">{stats.map((stat, index) => { const Icon = icons[index % icons.length]; return <article className="stat-card" key={stat.label}><div className="stat-top"><span className={`stat-icon ${stat.tone ?? "blue"}`}><Icon size={19} /></span><span className="mini-trend">â€¢â€¢â€¢</span></div><div className="stat-label">{stat.label}</div><div className="stat-value">{stat.value}</div><div className="stat-meta">{stat.meta}</div></article>; })}</section>;
}

function DemoModal({ module, title, fields, initial, onSave, onClose }: { module: string; title: string; fields: string[]; initial?: Record<string, string>; onSave: (fields: Record<string, string>) => Promise<void>; onClose: () => void }) {
  const locationForm = fields.some((field) => field === "Latitude" || field === "Radius");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true); setMessage("");
    const form = new FormData(event.currentTarget);
    try {
      const values: Record<string, string> = { ...initial };
      for (const [key, value] of form.entries()) {
        if (typeof value === "string") { values[key] = value; continue; }
        if (!value.size) continue;
        const upload = new FormData(); upload.set("module", module); upload.set("file", value);
        const response = await fetch("/api/feature-uploads", { method: "POST", body: upload });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error ?? "Lampiran gagal diunggah.");
        values[key] = body.url;
      }
      await onSave(values);
    }
    catch (cause) { setMessage(cause instanceof Error ? cause.message : "Data gagal disimpan."); }
    finally { setPending(false); }
  }
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="demo-modal" role="dialog" aria-modal="true" aria-label={title}>
      <form onSubmit={submit}>
        <header><div><span className="eyebrow">FORM DATA</span><h2>{title}</h2></div><button className="icon-button" type="button" onClick={onClose}><X size={20} /></button></header>
        <div className="modal-body">
          {locationForm ? <div className="map-placeholder"><MapPin size={34} /><strong>Koordinat lokasi</strong><span>Isi latitude, longitude, dan radius sesuai lokasi perusahaan.</span></div> : null}
          {message ? <div className="error-box" role="alert">{message}</div> : null}
          <div className="modal-form-grid">{fields.map((field, index) => (
            <label className={`field ${index === fields.length - 1 && fields.length % 2 === 1 ? "full" : ""}`} key={field}>
              <span className="field-label">{field}</span>
              {/foto|gambar|bukti|lampiran|sertifikat/i.test(field) ? <><input className="input" name={field} type="file" accept=".pdf,image/jpeg,image/png,image/webp" />{initial?.[field] ? <a className="text-link" href={initial[field]} target="_blank">Lihat lampiran saat ini</a> : null}</> : /deskripsi|alamat|catatan|alasan/i.test(field) ?
                <textarea className="input" name={field} defaultValue={initial?.[field] ?? ""} placeholder={`Masukkan ${field.toLowerCase()}`} /> :
                <input className="input" name={field} defaultValue={initial?.[field] ?? ""} placeholder={`Masukkan ${field.toLowerCase()}`} type={/tanggal/i.test(field) ? "date" : /email/i.test(field) ? "email" : /latitude|longitude|radius|nominal|tenor|toleransi|jumlah|durasi/i.test(field) ? "number" : /jam masuk|jam pulang/i.test(field) ? "time" : "text"} required={index === 0} step={/latitude|longitude/i.test(field) ? "any" : undefined} />}
            </label>
          ))}</div>
        </div>
        <footer><button className="btn btn-outline btn-compact" type="button" onClick={onClose}>Batal</button><button className="btn btn-primary btn-compact" disabled={pending} type="submit">{pending ? "Menyimpan..." : "Simpan Data"}</button></footer>
      </form>
    </section>
  </div>;
}

function displayValue(record: FeatureRecord, column: string, index: number, formFields?: string[]) {
  const values = record.fields;
  const normalized = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");
  const target = normalized(column).replace(/^(nama|daftar)/, "");
  const key = Object.keys(values).find((field) => normalized(field) === normalized(column) || normalized(field).includes(target) || target.includes(normalized(field)));
  if (key) return values[key] || "â€”";
  if (/tanggal dibuat|terdaftar/i.test(column)) return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(new Date(record.createdAt));
  const fallback = formFields?.[index];
  return fallback && values[fallback] ? values[fallback] : "â€”";
}

function downloadCsv(columns: string[], records: FeatureRecord[], slug: string) {
  const headers = columns.filter((column) => column !== "Aksi");
  const escape = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;
  const rows = records.map((record) => headers.map((column, index) => escape(/status/i.test(column) ? record.status : displayValue(record, column, index))).join(","));
  const csv = `\uFEFF${headers.map(escape).join(",")}\r\n${rows.join("\r\n")}`;
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a"); link.href = url; link.download = `${slug.replaceAll("/", "-")}.csv`; link.click(); URL.revokeObjectURL(url);
}

function InvoiceModal({ onClose }: { onClose: () => void }) {
  return <div className="modal-backdrop"><section className="demo-modal invoice-modal" role="dialog" aria-modal="true"><header><div><span className="eyebrow">INVOICE</span><h2>#INV-10261</h2></div><button className="icon-button" onClick={onClose}><X size={20} /></button></header><div className="invoice-sheet"><div className="invoice-brand"><div className="plan-icon"><ReceiptText size={20} /></div><div><strong>TepatWaktu</strong><small>Langganan HRIS</small></div><StatusPill value="Menunggu Pembayaran" /></div><div className="invoice-customer"><span><small>Ditagihkan kepada</small><strong>Ruang Kerja Utama</strong></span><span><small>Tanggal invoice</small><strong>16 Oktober 2026</strong></span></div><div className="invoice-lines"><span>Paket Basic+ Â· 1 bulan <strong>Rp 60.000</strong></span><span>Biaya admin <strong>Rp 0</strong></span><span className="total">Total Pembayaran <strong>Rp 60.000</strong></span></div></div><div className="payment-row"><button className="filter-control">Pilih Metode Bayar <ChevronDownMini /></button><button className="btn btn-primary btn-compact"><CreditCard size={16} />Bayar Sekarang</button></div></section></div>;
}

function Field({ label, placeholder, select = false, full = false }: { label: string; placeholder: string; select?: boolean; full?: boolean }) {
  return <label className={`field ${full ? "full" : ""}`}><span className="field-label">{label}</span>{select ? <select className="input" defaultValue=""><option value="" disabled>{placeholder}</option><option>Pilihan contoh</option></select> : label.toLowerCase().includes("deskripsi") || label.toLowerCase().includes("alamat") || label.toLowerCase().includes("catatan") ? <textarea className="input" placeholder={placeholder} /> : <input className="input" placeholder={placeholder} />}</label>;
}

function PersonCell({ name }: { name: string }) {
  return <span className="person-cell"><i>{name.split(" ").map((word) => word[0]).join("").slice(0, 2)}</i><span><strong>{name}</strong><small>{people.find((person) => person[1] === name)?.[2] ?? "Karyawan"}</small></span></span>;
}

function StatusPill({ value }: { value: string }) {
  const lower = value.toLowerCase();
  const tone = /aktif|terbit|disetujui|selesai|final|dibayar|lunas|tersedia|tepat waktu/.test(lower) ? "green" : /menunggu|terjadwal|berjalan|terbatas|draft/.test(lower) ? "orange" : /tolak|gagal|terlambat|tidak|nonaktif/.test(lower) ? "red" : "blue";
  return <span className={`status-pill ${tone}`}><i />{value}</span>;
}

function RankingCard({ title, tone, names }: { title: string; tone: "green" | "orange"; names: string[] }) {
  return <section className="module-card ranking-card"><div className="card-heading-row"><div><span className="eyebrow">PERINGKAT BULAN INI</span><h2>{title}</h2></div><BarChart3 size={19} /></div><ol>{names.map((name, index) => <li key={name}><span className={`rank ${tone}`}>{index + 1}</span><PersonCell name={name} /><strong>{tone === "green" ? `${98 - index * 2}%` : `${12 - index * 2}x`}</strong></li>)}</ol></section>;
}

function SettingsSection({ title, description, children, id }: { title: string; description: string; children: React.ReactNode; id?: string }) {
  return <section className="settings-section" id={id}><div className="settings-title"><h2>{title}</h2><p>{description}</p></div><div>{children}</div></section>;
}

function ToggleRow({ label, description, enabled }: { label: string; description: string; enabled: boolean }) {
  const [on, setOn] = useState(enabled);
  return <button className="toggle-row" onClick={() => setOn((value) => !value)} type="button"><span><strong>{label}</strong><small>{description}</small></span><i className={`switch ${on ? "on" : ""}`}><b /></i></button>;
}

function EmptyState() {
  return <div className="empty-state modern"><FileSpreadsheet size={30} /><strong>Data tidak ditemukan</strong><span>Ubah kata kunci atau filter untuk melihat hasil lain.</span></div>;
}

function MissingPage({ slug }: { slug: string }) {
  return <section className="missing-page"><div><AlertTriangle size={28} /><span>UI PREVIEW</span></div><h1>Halaman belum tersedia</h1><p>Konfigurasi tampilan untuk <code>{slug}</code> belum ditambahkan.</p><Link className="btn btn-primary" href="/dashboard">Kembali ke Dashboard</Link></section>;
}

function ChevronDownMini() {
  return <span aria-hidden="true" style={{ fontSize: 11 }}>â–¼</span>;
}

function requestScreen(title: string, description: string, columns: string[], rows: string[][], action: string, form = ["Nama Karyawan", "Jenis Pengajuan", "Tanggal Mulai", "Tanggal Selesai", "Alasan"]): ScreenConfig {
  return { title, description, breadcrumb: `Beranda / Pengajuan / ${title.replace("Daftar Pengajuan ", "")}`, action, exportable: true, columns, rows, filters: ["Oktober", "2026", "Menunggu", "Disetujui", "Ditolak"], form };
}

function isStatus(value: string) {
  return /^(Aktif|Nonaktif|Terbit|Terjadwal|Draft|Menunggu|Disetujui|Ditolak|Tepat Waktu|Terlambat|Izin|Selesai|Final|Dibayar|Berjalan|Lunas|Tersedia|Terbatas|Tidak Lengkap|Menunggu Pembayaran)$/.test(value);
}

function EmployeeDetailSections() {
  return <section className="module-card detail-section"><div className="detail-section-head"><div><UserRound size={17} /><h2>Data Pekerjaan</h2></div><button className="text-action">Atur Penempatan</button></div><div className="detail-grid"><div className="detail-field"><small>Divisi</small><strong>Engineering</strong></div><div className="detail-field"><small>Jabatan</small><strong>Software Engineer</strong></div><div className="detail-field"><small>Shift</small><strong>Shift Pagi</strong></div><div className="detail-field"><small>Mulai Kerja</small><strong>12 Januari 2024</strong></div><div className="detail-field"><small>Lokasi Presensi</small><strong>Kantor Utama</strong></div><div className="detail-field"><small>Status Karyawan</small><strong>Tetap</strong></div></div></section>;
}

function RequestDetailSections() {
  return <section className="module-card detail-section"><div className="detail-section-head"><div><CalendarDays size={17} /><h2>Validasi Pengajuan</h2></div><StatusPill value="Menunggu" /></div><div className="validation-list"><div><CheckCircle2 size={16} /><span><strong>Data karyawan valid</strong><small>Karyawan aktif pada periode pengajuan.</small></span></div><div><CheckCircle2 size={16} /><span><strong>Tidak ada benturan periode</strong><small>Pengajuan tidak bertabrakan dengan jadwal lain.</small></span></div><div><AlertTriangle size={16} /><span><strong>Memerlukan persetujuan manager</strong><small>Nilai atau durasi melewati batas persetujuan langsung.</small></span></div></div></section>;
}

function InvoiceDetailPage({ id }: { id: string }) {
  return <>
    <PageHeader title="Detail Invoice" description="Rincian paket, periode, nominal, dan status pembayaran langganan." breadcrumb="Beranda / Langganan / Invoice / Detail" actions={<><Link className="btn btn-outline btn-compact" href={"/dashboard/langganan" as Route}>Kembali</Link><button className="btn btn-outline btn-compact"><Download size={15} />Unduh Invoice</button></>} />
    <div className="invoice-detail-layout">
      <section className="module-card invoice-detail-sheet">
        <div className="invoice-detail-brand"><div><span className="plan-icon"><ReceiptText size={20} /></span><span><strong>TepatWaktu</strong><small>Solusi Presensi & HRIS</small></span></div><div><span className="eyebrow">INVOICE</span><h2>#{id.toUpperCase()}</h2><StatusPill value="Lunas" /></div></div>
        <div className="invoice-addresses"><div><small>DITAGIHKAN KEPADA</small><strong>Ruang Kerja Utama</strong><span>admin@tepatwaktu.id</span><span>Makassar, Sulawesi Selatan</span></div><div><small>INFORMASI TAGIHAN</small><span>Tanggal invoice <strong>16 September 2026</strong></span><span>Jatuh tempo <strong>16 September 2026</strong></span><span>Metode <strong>Virtual Account</strong></span></div></div>
        <table className="invoice-detail-table"><thead><tr><th>Deskripsi</th><th>Periode</th><th>Qty</th><th>Jumlah</th></tr></thead><tbody><tr><td><strong>Paket Basic+</strong><small>Akses fitur premium Â· maksimal 50 karyawan</small></td><td>Sepâ€“Okt 2026</td><td>1</td><td>Rp 60.000</td></tr></tbody></table>
        <div className="invoice-totals"><span>Subtotal <strong>Rp 60.000</strong></span><span>Potongan <strong>Rp 0</strong></span><span>Biaya admin <strong>Rp 0</strong></span><span className="total">Total Pembayaran <strong>Rp 60.000</strong></span></div>
        <div className="invoice-note"><ShieldCheck size={17} /><span><strong>Pembayaran terverifikasi</strong><small>Transaksi berhasil dikonfirmasi pada 16 September 2026, 10:24 WITA.</small></span></div>
      </section>
      <aside className="detail-side"><section className="module-card timeline-card"><div className="detail-section-head"><div><Clock3 size={17} /><h2>Status Pembayaran</h2></div></div><ol className="activity-timeline"><li><i className="green" /><div><strong>Pembayaran berhasil</strong><span>16 Sep 2026 Â· 10:24 WITA</span><p>Langganan diperpanjang otomatis.</p></div></li><li><i className="blue" /><div><strong>Pembayaran diterima</strong><span>16 Sep 2026 Â· 10:23 WITA</span><p>Gateway mengirim konfirmasi transaksi.</p></div></li><li><i /><div><strong>Invoice dibuat</strong><span>16 Sep 2026 Â· 10:20 WITA</span></div></li></ol></section></aside>
    </div>
  </>;
}

function ImageIconFallback() {
  return <span aria-hidden="true">IMG</span>;
}
