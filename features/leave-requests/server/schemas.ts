import { z } from "zod";
import { LEAVE_TYPES, type LeaveType } from "@/features/leave-requests/leave-types";

// Labels and helpers live in leave-types.ts (no zod, safe for client components); re-exported for server code.
export { LEAVE_TYPES, leaveDays, leaveLabel, leaveTypeLabels, SPECIAL_LEAVE_SUGGESTIONS, type LeaveType } from "@/features/leave-requests/leave-types";

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
    while (!isWorkDay(day)) { day = addDay(day); if (++guard > 31) return { ok: false, error: "Jadwal kerja karyawan ini tidak punya hari kerja. Periksa jadwal jabatannya." }; }
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

