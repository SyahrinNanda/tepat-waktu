import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PayslipDocument } from "@/features/payslips/components/payslip-document";
import { getPayslip } from "@/features/payslips/server/payslip-service";
import { getPayrollRules } from "@/features/payslips/server/payroll-settings";
import { payslipPeriod } from "@/features/payslips/payslip-query";
import { requireCompanyRole } from "@/lib/current-company";

export const metadata: Metadata = { title: "Slip Gaji" };
type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ year?: string; month?: string }> };

export default async function Page({ params, searchParams }: Props) {
  const context = await requireCompanyRole(["admin", "general_manager", "hrd"]);
  const [{ id }, query] = await Promise.all([params, searchParams]);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { periodStartDay } = await getPayrollRules(context.companyId);
  const { year, month } = payslipPeriod(query, context.timezone, periodStartDay);
  const slip = await getPayslip(context.companyId, id, year, month);
  if (!slip) notFound();
  return <PayslipDocument slip={slip} companyName={context.companyName}/>;
}
