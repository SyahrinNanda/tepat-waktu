export const categoryKeys = [
  "sexual_harassment", "bullying", "toxic_environment", "discrimination", "violence",
  "abuse_of_power", "safety", "salary_rights", "facilities", "other",
] as const;
export type ComplaintCategory = typeof categoryKeys[number];

export const categoryLabels: Record<ComplaintCategory, string> = {
  sexual_harassment: "Pelecehan Seksual",
  bullying: "Perundungan / Bullying",
  toxic_environment: "Lingkungan Kerja Toxic",
  discrimination: "Diskriminasi",
  violence: "Kekerasan / Ancaman",
  abuse_of_power: "Penyalahgunaan Wewenang",
  safety: "Keselamatan Kerja (K3)",
  salary_rights: "Gaji & Hak Karyawan",
  facilities: "Fasilitas Kerja",
  other: "Lainnya",
};

export const statusKeys = ["new", "reviewing", "in_progress", "resolved", "rejected"] as const;
export type ComplaintStatus = typeof statusKeys[number];

export const statusLabels: Record<ComplaintStatus, string> = {
  new: "Baru",
  reviewing: "Ditinjau",
  in_progress: "Diproses",
  resolved: "Selesai",
  rejected: "Ditolak",
};

export const statusTone: Record<ComplaintStatus, "blue" | "orange" | "green" | "red" | "gray"> = {
  new: "blue",
  reviewing: "orange",
  in_progress: "orange",
  resolved: "green",
  rejected: "gray",
};
