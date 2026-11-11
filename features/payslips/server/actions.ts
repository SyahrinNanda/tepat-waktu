"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { employees } from "@/db/schema";
import { requireCompanyRole } from "@/lib/current-company";
import { payrollRulesSchema, savePayrollRules } from "./payroll-settings";
import { finalizePayslips, unlockPayslip } from "./payslip-service";

const period = { year: z.coerce.number().int().min(2000).max(2100), month: z.coerce.number().int().min(1).max(12) };

async function payslipContext() {
  return requireCompanyRole(["admin", "general_manager", "hrd"]);
}

export async function finalizePayslipsAction(input: { employeeIds: string[]; year: number; month: number }) {
  const parsed = z.object({ employeeIds: z.array(z.uuid()).min(1).max(500), ...period }).parse(input);
  const context = await payslipContext();
  const owned = await db.select({ id: employees.id }).from(employees)
    .where(and(eq(employees.companyId, context.companyId), inArray(employees.id, parsed.employeeIds)));
  const count = await finalizePayslips(context.companyId, owned.map((row) => row.id), parsed.year, parsed.month, context.session.user.id);
  revalidatePath("/dashboard/karyawan/slip-gaji");
  return { count };
}

export async function unlockPayslipAction(input: { employeeId: string; year: number; month: number }) {
  const parsed = z.object({ employeeId: z.uuid(), ...period }).parse(input);
  const context = await payslipContext();
  const count = await unlockPayslip(context.companyId, parsed.employeeId, parsed.year, parsed.month);
  revalidatePath("/dashboard/karyawan/slip-gaji");
  return { count };
}

/** Saves the company's payslip rules (break, late and alpa deductions). Locked slips keep their numbers. */
export async function savePayrollRulesAction(input: unknown): Promise<{ ok: boolean; error?: string }> {
  const context = await payslipContext();
  const parsed = payrollRulesSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Pengaturan tidak valid." };
  await savePayrollRules(context.companyId, parsed.data, context.session.user.id);
  revalidatePath("/dashboard/karyawan/slip-gaji", "layout");
  return { ok: true };
}
