import type { Metadata } from "next";
import { PayrollRulesForm } from "@/features/payslips/components/payroll-rules-form";
import { getPayrollRules } from "@/features/payslips/server/payroll-settings";
import { requireCompanyRole } from "@/lib/current-company";

export const metadata: Metadata = { title: "Pengaturan Perhitungan Gaji" };

export default async function Page() {
  const context = await requireCompanyRole(["admin", "general_manager", "hrd"]);
  const rules = await getPayrollRules(context.companyId);
  return <PayrollRulesForm initial={rules}/>;
}
