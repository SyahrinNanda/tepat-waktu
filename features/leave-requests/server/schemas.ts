import { z } from "zod";

export const leaveInputSchema = z.object({
  employeeId: z.uuid(),
  type: z.enum(["annual", "sick", "permission"]),
  startDate: z.iso.date(),
  endDate: z.iso.date(),
  reason: z.string().trim().min(3).max(500),
}).refine((value) => value.endDate >= value.startDate, { message: "Tanggal selesai tidak boleh sebelum tanggal mulai." });

export const reviewerRoles = ["admin", "owner", "general_manager", "hrd"];
