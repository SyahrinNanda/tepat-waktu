import { z } from "zod";

export const leaveInputSchema = z.object({
  employeeId: z.uuid(),
  type: z.enum(["annual", "sick", "permission"]),
  startDate: z.iso.date(),
  endDate: z.iso.date(),
  reason: z.string().trim().min(3).max(500),
  paid: z.boolean().optional(),
}).refine((value) => value.endDate >= value.startDate, { message: "Tanggal selesai tidak boleh sebelum tanggal mulai." });

export const reviewerRoles = ["admin", "owner", "general_manager", "hrd"];

/** Cuti Tahunan & Sakit are paid by default; Izin is unpaid unless a reviewer decides otherwise. */
export function defaultLeavePaid(type: "annual" | "sick" | "permission") { return type !== "permission"; }

/** Only reviewers may choose; everyone else gets the default for the leave type. */
export function resolveLeavePaid(input: { type: "annual" | "sick" | "permission"; paid?: boolean }, canReview: boolean) {
  return canReview && typeof input.paid === "boolean" ? input.paid : defaultLeavePaid(input.type);
}
