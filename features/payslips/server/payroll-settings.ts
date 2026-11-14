import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { payrolls, payrollSettings } from "@/db/schema";
import { MAX_PERIOD_START_DAY, payrollPeriod } from "@/features/payslips/payroll-period";
import { DEFAULT_PAYROLL_RULES, type PayrollRules } from "./payslip-calculation";

export const payrollRulesSchema = z.object({
  breakMinutes: z.coerce.number().int().min(0, "Durasi istirahat tidak boleh negatif.").max(240, "Durasi istirahat maksimal 240 menit."),
  breakMinWorkMinutes: z.coerce.number().int().min(0).max(720),
  lateDeductionMode: z.enum(["none", "per_day", "per_hour", "per_minute"]),
  lateDeductionAmount: z.coerce.number().int().min(0).max(100_000_000),
  absentDeductionMode: z.enum(["daily_rate", "fixed", "none"]),
  absentDeductionAmount: z.coerce.number().int().min(0).max(100_000_000),
  periodStartDay: z.coerce.number().int().min(1, "Tanggal mulai periode minimal 1.").max(MAX_PERIOD_START_DAY, `Tanggal mulai periode maksimal ${MAX_PERIOD_START_DAY}.`).default(1),
});

/** The company's payslip rules; defaults until an admin saves them. */
export async function getPayrollRules(companyId: string): Promise<PayrollRules> {
  const [row] = await db.select().from(payrollSettings).where(eq(payrollSettings.companyId, companyId)).limit(1);
  if (!row) return DEFAULT_PAYROLL_RULES;
  const parsed = payrollRulesSchema.safeParse(row);
  return parsed.success ? parsed.data : DEFAULT_PAYROLL_RULES;
}

/** The newest locked payslip period of the company and the last date it covered (null when none is locked). */
export async function latestFinalPeriod(companyId: string) {
  const [row] = await db.select({ year: payrolls.year, month: payrolls.month, end: payrolls.periodEnd }).from(payrolls)
    .where(and(eq(payrolls.companyId, companyId), eq(payrolls.status, "Final")))
    .orderBy(desc(payrolls.year), desc(payrolls.month), desc(payrolls.periodEnd)).limit(1);
  return row ? { year: row.year, month: row.month, end: row.end ?? payrollPeriod(row.year, row.month, 1).end } : null;
}

export async function savePayrollRules(companyId: string, rules: PayrollRules, userId: string) {
  const values = { ...rules, updatedBy: userId, updatedAt: new Date() };
  await db.insert(payrollSettings).values({ companyId, ...values }).onConflictDoUpdate({ target: payrollSettings.companyId, set: values });
}
