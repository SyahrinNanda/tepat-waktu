import { z } from "zod";

export const LEAVE_TYPES = ["annual", "sick", "permission", "special"] as const;
export type LeaveType = (typeof LEAVE_TYPES)[number];

export const leaveTypeLabels: Record<LeaveType, string> = { annual: "Cuti Tahunan", sick: "Sakit", permission: "Izin", special: "Cuti Khusus" };

/** "Cuti Khusus · Menikah" for special leave, otherwise the category label. */
export function leaveLabel(type: string, specialName?: string | null) {
  const base = leaveTypeLabels[type as LeaveType] ?? type;
  return type === "special" && specialName ? `${base} · ${specialName}` : base;
}

export const leaveInputSchema = z.object({
  employeeId: z.uuid(),
  type: z.enum(LEAVE_TYPES),
  specialLeaveTypeId: z.uuid().nullish(),
  startDate: z.iso.date(),
  endDate: z.iso.date(),
  reason: z.string().trim().min(3).max(500),
  paid: z.boolean().optional(),
  /** Asset id from /api/feature-uploads. Required for a new request; on edit, omitted = keep the current file. */
  attachmentAssetId: z.uuid().nullish(),
})
  .refine((value) => value.endDate >= value.startDate, { message: "Tanggal selesai tidak boleh sebelum tanggal mulai." })
  .refine((value) => value.type !== "special" || !!value.specialLeaveTypeId, { message: "Pilih jenis cuti khusus." });

export const specialLeaveTypeSchema = z.object({
  name: z.string().trim().min(2, "Nama jenis cuti minimal 2 karakter.").max(60, "Nama jenis cuti maksimal 60 karakter."),
  durationDays: z.number().int().min(1, "Durasi minimal 1 hari kerja.").max(260, "Durasi maksimal 260 hari kerja.").nullish(),
  paid: z.boolean(),
});

const addDay = (date: string, days = 1) => new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

/**
 * Dates of a Cuti Khusus in the employee's working days. With a fixed duration the end date is computed:
 * the leave starts on the first working day from `start` and runs for `durationDays` working days
 * (days off in the schedule are skipped, not counted). Without one, the chosen range is kept and its
 * working days are counted.
 */
export function planSpecialLeave(input: { start: string; end?: string; durationDays: number | null; isWorkDay: (date: string) => boolean }):
  { ok: true; startDate: string; endDate: string; workDays: number } | { ok: false; error: string } {
  const { isWorkDay } = input;
  if (input.durationDays) {
    let day = input.start, guard = 0;
    while (!isWorkDay(day)) { day = addDay(day); if (++guard > 31) return { ok: false, error: "Jadwal kerja karyawan ini tidak punya hari kerja. Periksa jadwal divisinya." }; }
    const startDate = day;
    let counted = 1;
    while (counted < input.durationDays) { day = addDay(day); if (isWorkDay(day)) counted++; if (++guard > 800) return { ok: false, error: "Durasi terlalu panjang untuk jadwal kerja karyawan ini." }; }
    return { ok: true, startDate, endDate: day, workDays: input.durationDays };
  }
  const end = input.end ?? input.start;
  if (end < input.start) return { ok: false, error: "Tanggal selesai tidak boleh sebelum tanggal mulai." };
  let workDays = 0;
  for (let day = input.start, guard = 0; day <= end && guard < 800; day = addDay(day), guard++) if (isWorkDay(day)) workDays++;
  if (!workDays) return { ok: false, error: "Tanggal yang dipilih bukan hari kerja karyawan ini." };
  return { ok: true, startDate: input.start, endDate: end, workDays };
}

export const reviewerRoles = ["admin", "owner", "general_manager", "hrd"];

/**
 * Cuti Tahunan & Sakit are paid by default; Izin is unpaid unless a reviewer decides otherwise.
 * Cuti Khusus follows the setting of its kind (specialPaid).
 */
export function defaultLeavePaid(type: LeaveType, specialPaid?: boolean) {
  if (type === "special") return specialPaid ?? true;
  return type !== "permission";
}

/** Only reviewers may choose; everyone else gets the default for the leave type. */
export function resolveLeavePaid(input: { type: LeaveType; paid?: boolean }, canReview: boolean, specialPaid?: boolean) {
  return canReview && typeof input.paid === "boolean" ? input.paid : defaultLeavePaid(input.type, specialPaid);
}

export function leaveDays(start: string, end: string) {
  return Math.floor((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000) + 1;
}

/**
 * Common kinds under Indonesian labor law (UU 13/2003 ps. 82 & 93), offered as one-click suggestions.
 * Durations are working days; Melahirkan (3 bulan) and Keguguran (1,5 bulan) assume a 5-day week, so a
 * company working 6 days a week should raise them.
 */
export const SPECIAL_LEAVE_SUGGESTIONS: { name: string; durationDays: number }[] = [
  { name: "Menikah", durationDays: 3 },
  { name: "Menikahkan Anak", durationDays: 2 },
  { name: "Khitanan / Baptis Anak", durationDays: 2 },
  { name: "Istri Melahirkan / Keguguran", durationDays: 2 },
  { name: "Melahirkan", durationDays: 65 },
  { name: "Keguguran", durationDays: 33 },
  { name: "Berduka (Keluarga Inti)", durationDays: 2 },
  { name: "Berduka (Anggota Keluarga Serumah)", durationDays: 1 },
];
