"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { employeeLeaveEntitlements, employees } from "@/db/schema";
import { requireCompanyRole } from "@/lib/current-company";

export async function saveLeaveEntitlement(input: { employeeId: string; year: number; maximumDays: number }) {
  const parsed = z.object({ employeeId: z.uuid(), year: z.number().int().min(2020).max(2100), maximumDays: z.number().int().min(0).max(365) }).parse(input);
  const context = await requireCompanyRole(["admin", "general_manager", "hrd"]);
  const [employee] = await db.select({ id: employees.id }).from(employees).where(and(eq(employees.id, parsed.employeeId), eq(employees.companyId, context.companyId))).limit(1);
  if (!employee) throw new Error("Karyawan tidak ditemukan.");
  await db.insert(employeeLeaveEntitlements).values({ companyId: context.companyId, ...parsed }).onConflictDoUpdate({
    target: [employeeLeaveEntitlements.employeeId, employeeLeaveEntitlements.year],
    set: { maximumDays: parsed.maximumDays, updatedAt: new Date() },
  });
  revalidatePath("/dashboard/karyawan/laporan-cuti");
  return { ok: true };
}
