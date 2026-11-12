"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { companies, employeeLeaveEntitlements, employees } from "@/db/schema";
import { requireCompanyRole } from "@/lib/current-company";
import { LEAVE_ELIGIBILITY } from "@/features/leave-requests/annual-leave";

export type LeaveActionResult = { ok: true } | { ok: false; error: string };

function refresh() {
  revalidatePath("/dashboard/karyawan/laporan-cuti");
  revalidatePath("/dashboard/pengajuan/izin-cuti");
}

/**
 * Days of one employee's leave period; `year` = the year that period starts (work anniversary).
 * maximumDays null removes the override, so the company rule applies again.
 */
export async function saveLeaveEntitlement(input: { employeeId: string; year: number; maximumDays: number | null }): Promise<LeaveActionResult> {
  const parsed = z.object({ employeeId: z.uuid(), year: z.number().int().min(2000).max(2100), maximumDays: z.number().int().min(0, "Jatah minimal 0 hari.").max(365, "Jatah maksimal 365 hari.").nullable() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Data jatah cuti tidak valid." };
  const context = await requireCompanyRole(["admin", "general_manager", "hrd"]);
  const [employee] = await db.select({ id: employees.id }).from(employees).where(and(eq(employees.id, parsed.data.employeeId), eq(employees.companyId, context.companyId))).limit(1);
  if (!employee) return { ok: false, error: "Karyawan tidak ditemukan." };
  const { employeeId, year, maximumDays } = parsed.data;
  if (maximumDays === null) {
    await db.delete(employeeLeaveEntitlements).where(and(eq(employeeLeaveEntitlements.companyId, context.companyId), eq(employeeLeaveEntitlements.employeeId, employeeId), eq(employeeLeaveEntitlements.year, year)));
  } else {
    await db.insert(employeeLeaveEntitlements).values({ companyId: context.companyId, employeeId, year, maximumDays }).onConflictDoUpdate({
      target: [employeeLeaveEntitlements.employeeId, employeeLeaveEntitlements.year],
      set: { maximumDays, updatedAt: new Date() },
    });
  }
  refresh();
  return { ok: true };
}

const rulesSchema = z.object({
  days: z.number().int("Jatah harus bilangan bulat.").min(0, "Jatah minimal 0 hari.").max(60, "Jatah maksimal 60 hari per periode."),
  eligibility: z.enum(LEAVE_ELIGIBILITY),
  carryOver: z.boolean(),
  carryOverMax: z.number().int().min(1, "Batas sisa yang dibawa minimal 1 hari.").max(60, "Batas sisa yang dibawa maksimal 60 hari.").nullable(),
});

/** Company Cuti Tahunan rules (Admin / GM / HRD). */
export async function saveLeaveRules(input: z.input<typeof rulesSchema>): Promise<LeaveActionResult> {
  const parsed = rulesSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Aturan cuti tidak valid." };
  const context = await requireCompanyRole(["admin", "general_manager", "hrd"]);
  const rules = parsed.data;
  await db.update(companies).set({
    annualLeaveDays: rules.days, annualLeaveEligibility: rules.eligibility, annualLeaveCarryOver: rules.carryOver,
    annualLeaveCarryOverMax: rules.carryOver ? rules.carryOverMax : null, updatedAt: new Date(),
  }).where(eq(companies.id, context.companyId));
  refresh();
  return { ok: true };
}
