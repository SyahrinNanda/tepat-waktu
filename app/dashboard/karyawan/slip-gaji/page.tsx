import type { Metadata } from "next";
import { PayslipList } from "@/features/payslips/components/payslip-list";
import { listPayslips } from "@/features/payslips/server/payslip-service";
import { getPayrollRules } from "@/features/payslips/server/payroll-settings";
import { payslipPeriod } from "@/features/payslips/payslip-query";
import { payrollPeriod } from "@/features/payslips/payroll-period";
import { dateInTimeZone, requireCompanyRole } from "@/lib/current-company";

export const metadata: Metadata = { title: "Slip Gaji Karyawan" };
type Props = { searchParams: Promise<{ year?: string; month?: string }> };

export default async function Page({ searchParams }: Props) {
  const context = await requireCompanyRole(["admin", "general_manager", "hrd"]);
  const params = await searchParams;
  const today = dateInTimeZone(context.timezone);
  const currentYear = Number(today.slice(0, 4));
  // Without a chosen period the list opens on the payroll period running today.
  const { periodStartDay } = await getPayrollRules(context.companyId);
  const { year, month } = payslipPeriod(params, context.timezone, periodStartDay);
  const years = Array.from({ length: Math.max(currentYear - 2023 + 1, 1) }, (_, index) => currentYear - index);
  const slips = await listPayslips(context.companyId, year, month);
  const { start, end } = payrollPeriod(year, month, periodStartDay);
  return <PayslipList slips={slips} year={year} month={month} years={years} periodStart={start} periodEnd={end} periodStartDay={periodStartDay}/>;
}
