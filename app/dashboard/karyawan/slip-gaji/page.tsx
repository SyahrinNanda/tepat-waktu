import type { Metadata } from "next";
import { PayslipList } from "@/features/payslips/components/payslip-list";
import { listPayslips } from "@/features/payslips/server/payslip-service";
import { dateInTimeZone, requireCompanyRole } from "@/lib/current-company";

export const metadata: Metadata = { title: "Slip Gaji Karyawan" };
type Props = { searchParams: Promise<{ year?: string; month?: string }> };

export default async function Page({ searchParams }: Props) {
  const context = await requireCompanyRole(["admin", "general_manager", "hrd"]);
  const params = await searchParams;
  const today = dateInTimeZone(context.timezone);
  const currentYear = Number(today.slice(0, 4));
  const year = /^20\d{2}$/.test(params.year ?? "") ? Number(params.year) : currentYear;
  const month = /^(0?[1-9]|1[0-2])$/.test(params.month ?? "") ? Number(params.month) : Number(today.slice(5, 7));
  const years = Array.from({ length: Math.max(currentYear - 2023 + 1, 1) }, (_, index) => currentYear - index);
  const slips = await listPayslips(context.companyId, year, month);
  return <PayslipList slips={slips} year={year} month={month} years={years}/>;
}
