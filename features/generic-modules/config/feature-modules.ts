export const featureModules = [
  "pengumuman",
  "master/shift", "master/jam-kerja", "master/divisi", "master/jabatan",
  "master/lokasi-kunjungan", "master/lokasi-presensi", "master/istilah-gaji",
  "pengajuan/izin-cuti", "pengajuan/lembur", "pengajuan/kasbon", "pengajuan/klaim-beban",
  "kunjungan", "kunjungan/laporan", "karyawan/gaji", "karyawan/laporan-cuti",
  "payroll/istilah", "payroll", "kasbon/pembayaran",
  "perusahaan/istilah-keuangan", "perusahaan/laporan-keuangan",
  "pengaturan/ip-whitelist",
] as const;

export type FeatureModule = typeof featureModules[number];

export function isFeatureModule(value: string): value is FeatureModule {
  return (featureModules as readonly string[]).includes(value);
}

export function canReadFeature(module: FeatureModule, role: string) {
  if (role === "admin" || role === "owner" || role === "general_manager" || role === "hrd") return true;
  if (role === "manager") return !module.startsWith("pengaturan/") && !module.startsWith("perusahaan/") && !module.startsWith("payroll") && module !== "karyawan/gaji";
  return module.startsWith("pengajuan/") || module === "kunjungan" || module === "pengumuman";
}

export function canWriteFeature(module: FeatureModule, role: string) {
  if (role === "admin" || role === "owner" || role === "general_manager" || role === "hrd") return true;
  if (role === "manager") return module.startsWith("pengajuan/") || module === "kunjungan";
  return module.startsWith("pengajuan/") || module === "kunjungan";
}

export function canManageFeature(module: FeatureModule, role: string) {
  if (role === "admin" || role === "owner" || role === "general_manager" || role === "hrd") return true;
  return role === "manager" && (module.startsWith("pengajuan/") || module === "kunjungan");
}
