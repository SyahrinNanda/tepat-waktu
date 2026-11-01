export const featureModules = [
  "pengumuman",
  "master/shift", "master/jam-kerja", "master/divisi", "master/jabatan",
  "master/lokasi-kunjungan", "master/lokasi-presensi",
  "pengajuan/izin-cuti", "pengajuan/lembur",
  "kunjungan", "kunjungan/laporan", "karyawan/laporan-cuti",
  "pengaturan/ip-whitelist",
] as const;

export type FeatureModule = typeof featureModules[number];

export function isFeatureModule(value: string): value is FeatureModule {
  return (featureModules as readonly string[]).includes(value);
}

export function canReadFeature(module: FeatureModule, role: string) {
  if (role === "admin" || role === "owner" || role === "general_manager" || role === "hrd") return true;
  if (role === "manager") return !module.startsWith("pengaturan/");
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
