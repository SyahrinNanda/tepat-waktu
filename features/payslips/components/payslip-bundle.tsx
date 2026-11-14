"use client";

import Link from "next/link";
import type { Route } from "next";
import { useEffect } from "react";
import { ArrowLeft, FileSpreadsheet, Printer } from "lucide-react";
import { PayslipSheet } from "@/features/payslips/components/payslip-document";
import type { Payslip } from "@/features/payslips/server/payslip-service";
import { formatPeriodRange } from "@/features/payslips/payroll-period";

const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const rupiah = (value: number) => `Rp ${new Intl.NumberFormat("id-ID").format(value)}`;

/**
 * Every employee's payslip of one month on one printable document: one slip per page, itemized as on the
 * single slip page, then a recap page with the grand total. "Cetak / Simpan PDF" uses the browser's PDF printer.
 */
export function PayslipBundle({ slips, companyName, year, month, periodStart, periodEnd, query, autoPrint }: {
  slips: Payslip[]; companyName: string; year: number; month: number; periodStart: string; periodEnd: string; query: string; autoPrint: boolean;
}) {
  const period = `${monthNames[month - 1]} ${year} · ${formatPeriodRange(periodStart, periodEnd)}`;
  const totals = slips.reduce((sum, slip) => ({ gross: sum.gross + slip.grossPay, deductions: sum.deductions + slip.totalDeductions, net: sum.net + slip.netPay }), { gross: 0, deductions: 0, net: 0 });
  const drafts = slips.filter((slip) => slip.status === "draft").length;
  const search = new URLSearchParams({ year: String(year), month: String(month), ...(query ? { q: query } : {}) }).toString();

  useEffect(() => {
    if (!autoPrint || !slips.length) return;
    const timer = window.setTimeout(() => window.print(), 600);
    return () => window.clearTimeout(timer);
  }, [autoPrint, slips.length]);

  return <>
    <div className="payslip-actions no-print">
      <Link className="btn btn-outline btn-compact" href={`/dashboard/karyawan/slip-gaji?${search}` as Route}><ArrowLeft size={15}/> Kembali</Link>
      <span className="payslip-bundle-meta">{slips.length} slip · {period}{drafts ? ` · ${drafts} masih draft` : ""}</span>
      <a className="btn btn-outline btn-compact" href={`/api/payslips/export?${search}`}><FileSpreadsheet size={15}/> Unduh Excel</a>
      <button className="btn btn-primary btn-compact" disabled={!slips.length} onClick={() => window.print()}><Printer size={15}/> Cetak / Simpan PDF</button>
    </div>
    {!slips.length ? <div className="module-card empty-state">Tidak ada slip gaji untuk periode ini.</div> : <div className="payslip-bundle">
      {slips.map((slip) => <div className="payslip-bundle-page" key={slip.employee.id}><PayslipSheet slip={slip} companyName={companyName}/></div>)}
      <article className="payslip-doc payslip-bundle-recap">
        <header className="payslip-doc-head">
          <div><span className="payslip-doc-kicker">Rekap Gaji</span><h1>{companyName}</h1><p>Periode {period} · {slips.length} karyawan</p></div>
        </header>
        <table className="payslip-recap-table">
          <thead><tr><th>No</th><th>Karyawan</th><th>Divisi</th><th>Hadir</th><th>Pendapatan</th><th>Potongan</th><th>Gaji Bersih</th></tr></thead>
          <tbody>{slips.map((slip, index) => <tr key={slip.employee.id}>
            <td>{index + 1}</td>
            <td><strong>{slip.employee.name}</strong><small>{slip.employee.employeeCode}{slip.status === "draft" ? " · Draft" : ""}</small></td>
            <td>{slip.employee.department || "—"}</td>
            <td>{slip.summary.daysWorked}/{slip.summary.workingDays} hari</td>
            <td>{rupiah(slip.grossPay)}</td>
            <td>{rupiah(slip.totalDeductions)}</td>
            <td><strong>{rupiah(slip.netPay)}</strong></td>
          </tr>)}</tbody>
          <tfoot><tr><td colSpan={4}>Total ({slips.length} karyawan)</td><td>{rupiah(totals.gross)}</td><td>{rupiah(totals.deductions)}</td><td>{rupiah(totals.net)}</td></tr></tfoot>
        </table>
        <footer className="payslip-doc-net"><span>Total Gaji Bersih Dibayarkan</span><strong>{rupiah(totals.net)}</strong></footer>
      </article>
    </div>}
  </>;
}
