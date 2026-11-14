import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { FileText } from "lucide-react";
import { db } from "@/db";
import { employees } from "@/db/schema";
import { PayslipDocument } from "@/features/payslips/components/payslip-document";
import { getFinalPayslip, listFinalPeriods } from "@/features/payslips/server/payslip-service";
import { requireCompanyRole } from "@/lib/current-company";
import { formatPeriodRange } from "@/features/payslips/payroll-period";

export const metadata: Metadata = { title: "Slip Gaji Saya" };
type Props = { searchParams: Promise<{ year?: string; month?: string }> };

const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const rupiah = (value: number) => `Rp ${new Intl.NumberFormat("id-ID").format(value)}`;
const day = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric" });

/**
 * Every company user except the admin (and superadmin, who acts as admin) reads only their own payslips.
 * Only locked slips are shown: a draft can still change, so it is not published to the employee.
 */
export default async function Page({ searchParams }: Props) {
  const context = await requireCompanyRole(["general_manager", "hrd", "manager", "employee"]);
  const query = await searchParams;
  const [own] = await db.select({ id: employees.id }).from(employees)
    .where(and(eq(employees.companyId, context.companyId), eq(employees.userId, context.session.user.id))).limit(1);

  const year = /^20\d{2}$/.test(query.year ?? "") ? Number(query.year) : null;
  const month = /^(0?[1-9]|1[0-2])$/.test(query.month ?? "") ? Number(query.month) : null;
  if (own && year && month) {
    const slip = await getFinalPayslip(context.companyId, own.id, year, month);
    if (!slip) notFound();
    return <PayslipDocument slip={slip} companyName={context.companyName} mode="self" backHref="/dashboard/karyawan/slip-gaji-saya"/>;
  }

  const periods = own ? await listFinalPeriods(context.companyId, own.id) : [];
  return <>
    <div className="master-page-head"><span>Karyawan</span><h1>Slip Gaji Saya</h1><p>Beranda / Karyawan / Slip Gaji Saya</p></div>
    <section className="module-card payslip-card">
      {!own ? <div className="empty-state">Akun Anda belum terhubung dengan data karyawan. Hubungi HRD atau admin perusahaan.</div>
        : !periods.length ? <div className="empty-state">Belum ada slip gaji yang diterbitkan. Slip muncul di sini setelah HRD mengunci slip gaji bulanan.</div>
        : <div className="table-scroll"><table className="data-table payslip-table"><thead><tr><th>Periode</th><th>Gaji Bersih</th><th>Diterbitkan</th><th>Aksi</th></tr></thead>
          <tbody>{periods.map((period) => <tr key={`${period.year}-${period.month}`}>
            <td><strong>{monthNames[period.month - 1]} {period.year}</strong><small>{formatPeriodRange(period.periodStart, period.periodEnd)}</small></td>
            <td><strong>{rupiah(period.netPay)}</strong></td>
            <td>{day.format(period.finalizedAt)}</td>
            <td><Link className="btn btn-outline btn-xs" href={`/dashboard/karyawan/slip-gaji-saya?year=${period.year}&month=${period.month}`}><FileText size={13}/> Lihat Slip</Link></td>
          </tr>)}</tbody></table></div>}
    </section>
  </>;
}
