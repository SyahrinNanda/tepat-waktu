/** What each role can do. Shown on Pengaturan → User Level; the rules themselves live in the server guards. */
export const accessRoles = ["Admin", "General Manager", "HRD", "Manager", "Staf"] as const;

export type AccessRow = { feature: string; access: [string, string, string, string, string] };

export const roleAccessRows: AccessRow[] = [
  { feature: "Beranda dan ringkasan", access: ["Semua", "Semua", "Semua", "Divisi sendiri", "Data sendiri"] },
  { feature: "Check-in / Check-out", access: ["-", "Sendiri", "Sendiri", "Sendiri", "Sendiri"] },
  { feature: "Riwayat kehadiran", access: ["Semua", "Sendiri", "Sendiri", "Sendiri", "Sendiri"] },
  { feature: "Kehadiran Harian dan Laporan Bulanan", access: ["Kelola", "Kelola", "Kelola", "Lihat divisi", "-"] },
  { feature: "Jadwal, Hari Kerja, Divisi, Jabatan, Lokasi", access: ["Kelola", "Kelola", "Kelola", "-", "-"] },
  { feature: "Perhitungan Gaji dan Aturan Cuti", access: ["Kelola", "Kelola", "Kelola", "-", "-"] },
  { feature: "Daftar Karyawan", access: ["Kelola", "Kelola", "Kelola", "Lihat divisi", "-"] },
  { feature: "Daftar Gaji dan Slip Gaji karyawan", access: ["Kelola", "Kelola", "Kelola", "-", "-"] },
  { feature: "Slip Gaji Saya", access: ["-", "Sendiri", "Sendiri", "Sendiri", "Sendiri"] },
  { feature: "Laporan Cuti", access: ["Kelola", "Kelola", "Kelola", "Lihat divisi", "-"] },
  { feature: "Izin / Cuti dan Lembur", access: ["Kelola + setujui", "Kelola + setujui", "Kelola + setujui", "Ajukan sendiri", "Ajukan sendiri"] },
  { feature: "Kunjungan dan laporannya", access: ["Semua", "Semua", "Semua", "Divisi sendiri", "Sendiri"] },
  { feature: "Keluhan Karyawan", access: ["Tangani", "Laporan sendiri", "Tangani", "Laporan sendiri", "Laporan sendiri"] },
  { feature: "Pemberitahuan", access: ["Kelola", "Kelola", "Kelola", "Baca", "Baca"] },
  { feature: "User Login, Pengaturan, Langganan", access: ["Kelola", "-", "-", "-", "-"] },
];
