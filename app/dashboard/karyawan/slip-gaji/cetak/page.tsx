import type { Metadata } from "next";
import { PayslipBundle } from "@/features/payslips/components/payslip-bundle";
import { matchesPayslipQuery, payslipPeriod } from "@/features/payslips/payslip-query";
import { listPayslips } from "@/features/payslips/server/payslip-service";
import { getPayrollRules } from "@/features/payslips/server/payroll-settings";
import { payrollPeriod } from "@/features/payslips/payroll-period";
import { requireCompanyRole } from "@/lib/current-company";

const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
type Props = { searchParams: Promise<{ year?: string; month?: string; q?: string; print?: string }> };

// The print title is the default PDF file name.
export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const params = await searchParams;
  const month = Number(params.month), year = Number(params.year);
  return { title: { absolute: month >= 1 && month <= 12 && year ? `Slip Gaji Karyawan ${monthNames[month - 1]} ${year}` : "Slip Gaji Karyawan" } };
}

export default async function Page({ searchParams }: Props) {
  const context = await requireCompanyRole(["admin", "general_manager", "hrd"]);
  const params = await searchParams;
  const { periodStartDay } = await getPayrollRules(context.companyId);
  const { year, month } = payslipPeriod(params, context.timezone, periodStartDay);
  const query = params.q ?? "";
  const slips = (await listPayslips(context.companyId, year, month)).filter((slip) => matchesPayslipQuery(slip, query));
  const { start, end } = payrollPeriod(year, month, periodStartDay);
  return <PayslipBundle slips={slips} companyName={context.companyName} year={year} month={month} periodStart={start} periodEnd={end} query={query} autoPrint={params.print === "1"}/>;
}
