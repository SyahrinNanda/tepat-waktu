"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { FileText, Lock, Search, Settings2 } from "lucide-react";
import { confirmAction } from "@/components/confirm-dialog";
import { finalizePayslipsAction } from "@/features/payslips/server/actions";
import type { Payslip } from "@/features/payslips/server/payslip-service";

const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const basisLabels = { hourly: "Per Jam", daily: "Per Hari", monthly: "Per Bulan" } as const;
const rupiah = (value: number) => `Rp ${new Intl.NumberFormat("id-ID").format(value)}`;

export function PayslipList({ slips, year, month, years }: { slips: Payslip[]; year: number; month: number; years: number[] }) {
  const router = useRouter();
  const [query, setQuery] = useState(""), [selected, setSelected] = useState<string[]>([]), [error, setError] = useState(""), [pending, start] = useTransition();
  const filtered = useMemo(() => slips.filter((slip) => `${slip.employee.name} ${slip.employee.employeeCode} ${slip.employee.department}`.toLowerCase().includes(query.toLowerCase())), [slips, query]);
  const drafts = filtered.filter((slip) => slip.status === "draft");
  const totals = filtered.reduce((sum, slip) => ({ gross: sum.gross + slip.grossPay, deductions: sum.deductions + slip.totalDeductions, net: sum.net + slip.netPay }), { gross: 0, deductions: 0, net: 0 });

  function changePeriod(nextYear: number, nextMonth: number) { setSelected([]); router.push(`/dashboard/karyawan/slip-gaji?year=${nextYear}&month=${nextMonth}`); }
  async function finalize(ids: string[]) {
    if (!ids.length || !await confirmAction(`Kunci ${ids.length} slip gaji ${monthNames[month - 1]} ${year}? Slip yang dikunci tidak berubah walau gaji, kehadiran, atau izin diubah kemudian.`, "Kunci Slip Gaji")) return;
    setError("");
    start(async () => {
      try { await finalizePayslipsAction({ employeeIds: ids, year, month }); setSelected([]); router.refresh(); }
      catch (cause) { setError(cause instanceof Error ? cause.message : "Slip belum dapat dikunci."); }
    });
  }

  return <>
    <div className="master-page-head"><span>Karyawan</span><h1>Slip Gaji Karyawan</h1><p>Beranda / Karyawan / Slip Gaji</p></div>
    <section className="payslip-summary-grid">
      <article><span>Total pendapatan</span><strong>{rupiah(totals.gross)}</strong></article>
      <article><span>Total potongan</span><strong>{rupiah(totals.deductions)}</strong></article>
      <article className="highlight"><span>Total gaji bersih</span><strong>{rupiah(totals.net)}</strong></article>
      <article><span>Slip terkunci</span><strong>{filtered.length - drafts.length} / {filtered.length}</strong></article>
    </section>
    <section className="module-card payslip-card">
      <div className="payslip-toolbar">
        <div className="master-search"><Search size={16}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari nama karyawan..."/></div>
        <select value={month} onChange={(event) => changePeriod(year, Number(event.target.value))} aria-label="Bulan">{monthNames.map((name, index) => <option key={name} value={index + 1}>{name}</option>)}</select>
        <select value={year} onChange={(event) => changePeriod(Number(event.target.value), month)} aria-label="Tahun">{years.map((item) => <option key={item}>{item}</option>)}</select>
        <span/>
        <Link className="btn btn-outline btn-compact" href="/dashboard/karyawan/slip-gaji/pengaturan"><Settings2 size={15}/> Pengaturan Perhitungan</Link>
        <button className="btn btn-primary btn-compact" disabled={pending || !(selected.length || drafts.length)} onClick={() => finalize(selected.length ? selected : drafts.map((slip) => slip.employee.id))}>
          <Lock size={15}/> {pending ? "Mengunci..." : selected.length ? `Kunci ${selected.length} Slip` : "Kunci Semua Draft"}
        </button>
      </div>
      {error && <div className="announcement-inline-error">{error}</div>}
      <div className="table-scroll"><table className="data-table payslip-table"><thead><tr>
        <th><input type="checkbox" aria-label="Pilih semua draft" checked={drafts.length > 0 && drafts.every((slip) => selected.includes(slip.employee.id))} onChange={(event) => setSelected(event.target.checked ? drafts.map((slip) => slip.employee.id) : [])}/></th>
        <th>Karyawan</th><th>Basis Gaji</th><th>Kehadiran</th><th>Izin Dibayar / Tidak</th><th>Pendapatan</th><th>Potongan</th><th>Gaji Bersih</th><th>Status</th><th>Aksi</th>
      </tr></thead><tbody>{filtered.map((slip) => <tr key={slip.employee.id}>
        <td><input type="checkbox" disabled={slip.status === "final"} checked={selected.includes(slip.employee.id)} onChange={() => setSelected((current) => current.includes(slip.employee.id) ? current.filter((id) => id !== slip.employee.id) : [...current, slip.employee.id])}/></td>
        <td><strong>{slip.employee.name}</strong><small>{slip.employee.employeeCode} · {slip.employee.department}</small></td>
        <td>{basisLabels[slip.basis]}<small>{rupiah(slip.baseRate)}</small></td>
        <td>{slip.summary.daysWorked} / {slip.summary.workingDays} hari{slip.summary.absentDays ? <small className="payslip-warn">{slip.summary.absentDays} hari alpa</small> : null}</td>
        <td>{slip.summary.paidLeaveDays} / <span className={slip.summary.unpaidLeaveDays ? "payslip-warn" : ""}>{slip.summary.unpaidLeaveDays}</span> hari</td>
        <td>{rupiah(slip.grossPay)}</td>
        <td>{rupiah(slip.totalDeductions)}</td>
        <td><strong>{rupiah(slip.netPay)}</strong></td>
        <td><span className={`status-pill ${slip.status === "final" ? "green" : "orange"}`}><i/>{slip.status === "final" ? "Terkunci" : "Draft"}</span></td>
        <td><Link className="btn btn-outline btn-xs" href={`/dashboard/karyawan/slip-gaji/${slip.employee.id}?year=${year}&month=${month}`}><FileText size={13}/> Lihat Slip</Link></td>
      </tr>)}</tbody></table>
      {!filtered.length && <div className="empty-state">Tidak ada karyawan aktif yang cocok.</div>}</div>
    </section>
  </>;
}
