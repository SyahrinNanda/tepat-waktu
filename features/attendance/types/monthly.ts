export type MonthlyEmployeeSummary = {
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  department: string;
  shiftId: string | null;
  shiftName: string | null;
  locationId: string | null;
  locationName: string | null;
  // Counters
  presensiCount: number; // Jumlah kehadiran (present / late)
  izinCutiCount: number; // Jumlah izin/cuti (leave / absent)
  terlambatMinutes: number; // Total menit terlambat
  jamKerjaMinutes: number; // Total jam kerja reguler
  jamAktualMinutes: number; // Total jam aktual kerja
  jamIstirahatMinutes: number; // Total jam istirahat
  pulangAwalMinutes: number; // Total menit pulang lebih awal
  lemburMinutes: number; // Total menit lembur
  hasCheckedInTodayWithoutCheckOut: boolean;
};

export function parseTimeToMinutes(timeStr: string | null | undefined): number | null {
  if (!timeStr) return null;
  const parts = timeStr.split(":");
  if (parts.length < 2) return null;
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (isNaN(h) || isNaN(m)) return null;
  return h * 60 + m;
}

export function formatMinutesWeb(totalMinutes: number): string {
  if (totalMinutes <= 0) return "0j 0m";
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  return `${hours}j ${mins}m`;
}

export function formatMinutesExcel(totalMinutes: number): string {
  if (totalMinutes <= 0) return "0 Jam 0 Menit";
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  return `${hours} Jam ${mins} Menit`;
}
