import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PayslipDocument } from "@/features/payslips/components/payslip-document";
import { getPayslip } from "@/features/payslips/server/payslip-service";
import { dateInTimeZone, requireCompanyRole } from "@/lib/current-company";

export const metadata: Metadata = { title: "Slip Gaji" };
type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ year?: string; month?: string }> };

export default async function Page({ params, searchParams }: Props) {
  const context = await requireCompanyRole(["admin", "general_manager", "hrd"]);
  const [{ id }, query] = await Promise.all([params, searchParams]);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const today = dateInTimeZone(context.timezone);
  const year = /^20\d{2}$/.test(query.year ?? "") ? Number(query.year) : Number(today.slice(0, 4));
  const month = /^(0?[1-9]|1[0-2])$/.test(query.month ?? "") ? Number(query.month) : Number(today.slice(5, 7));
  const slip = await getPayslip(context.companyId, id, year, month);
  if (!slip) notFound();
  return <PayslipDocument slip={slip} companyName={context.companyName}/>;
}
