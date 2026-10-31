const labels: Record<string, string> = {
  present: "Hadir", late: "Terlambat", absent: "Tidak hadir", leave: "Cuti",
  pending: "Menunggu", approved: "Disetujui", rejected: "Ditolak",
  active: "Aktif", inactive: "Nonaktif", annual: "Cuti tahunan", sick: "Sakit", permission: "Izin",
  check_in: "Check-in", check_out: "Check-out",
};

const colors: Record<string, string> = {
  present: "green", approved: "green", active: "green",
  late: "orange", pending: "orange", permission: "orange",
  absent: "red", rejected: "red", inactive: "gray",
  leave: "blue", annual: "blue", sick: "blue",
  check_in: "green", check_out: "blue",
};

export function StatusBadge({ value }: { value: string }) {
  return <span className={`badge ${colors[value] ?? "gray"}`}>{labels[value] ?? value}</span>;
}
