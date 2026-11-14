import type { Metadata } from "next";
import { PayrollRulesForm } from "@/features/payslips/components/payroll-rules-form";
import { getPayrollRules, latestFinalPeriod } from "@/features/payslips/server/payroll-settings";
import { dateInTimeZone, requireCompanyRole } from "@/lib/current-company";

export const metadata: Metadata = { title: "Pengaturan Perhitungan Gaji" };

export default async function Page() {
  const context = await requireCompanyRole(["admin", "general_manager", "hrd"]);
  const [rules, latestFinal] = await Promise.all([getPayrollRules(context.companyId), latestFinalPeriod(context.companyId)]);
  return <PayrollRulesForm initial={rules} latestFinal={latestFinal} today={dateInTimeZone(context.timezone)}/>;
}
