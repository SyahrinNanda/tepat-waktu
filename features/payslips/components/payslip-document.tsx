"use client";

import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowLeft, Lock, LockOpen, Printer } from "lucide-react";
import { confirmAction } from "@/components/confirm-dialog";
import { finalizePayslipsAction, unlockPayslipAction } from "@/features/payslips/server/actions";
import type { Payslip, PayslipLine } from "@/features/payslips/server/payslip-service";
import { formatDuration } from "@/features/payslips/server/payslip-calculation";

const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const basisLabels = { hourly: "Per Jam", daily: "Per Hari", monthly: "Per Bulan" } as const;
const number = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 });
const rupiah = (value: number) => `Rp ${new Intl.NumberFormat("id-ID").format(value)}`;

/** `self`: an employee reading their own locked slip (no lock controls). */
export function PayslipDocument({ slip, companyName, mode = "manage", backHref }: { slip: Payslip; companyName: string; mode?: "manage" | "self"; backHref?: string }) {
  const router = useRouter();
  const [error, setError] = useState(""), [pending, start] = useTransition();
  const period = `${monthNames[slip.month - 1]} ${slip.year}`;
  const { summary } = slip;

  async function toggleLock() {
    const locking = slip.status === "draft";
    const message = locking
      ? `Kunci slip gaji ${slip.employee.name} untuk ${period}? Angka slip tidak akan berubah lagi.`
      : `Buka kunci slip ${slip.employee.name}? Slip akan dihitung ulang dari data gaji, kehadiran, dan izin terbaru.`;
    if (!await confirmAction(message, locking ? "Kunci Slip Gaji" : "Buka Kunci Slip")) return;
    setError("");
    start(async () => {
      try {
        if (locking) await finalizePayslipsAction({ employeeIds: [slip.employee.id], year: slip.year, month: slip.month });
        else await unlockPayslipAction({ employeeId: slip.employee.id, year: slip.year, month: slip.month });
        router.refresh();
      } catch (cause) { setError(cause instanceof Error ? cause.message : "Perubahan belum dapat disimpan."); }
    });
  }

  return <>
    <div className="payslip-actions no-print">
      <Link className="btn btn-outline btn-compact" href={(backHref ?? `/dashboard/karyawan/slip-gaji?year=${slip.year}&month=${slip.month}`) as Route}><ArrowLeft size={15}/> Kembali</Link>
      <span/>
      {mode === "manage" && <button className="btn btn-outline btn-compact" disabled={pending} onClick={toggleLock}>{slip.status === "final" ? <><LockOpen size={15}/> Buka Kunci</> : <><Lock size={15}/> Kunci Slip</>}</button>}
      <button className="btn btn-primary btn-compact" onClick={() => window.print()}><Printer size={15}/> Cetak / PDF</button>
    </div>
    {error && <div className="announcement-inline-error no-print">{error}</div>}
    <article className="payslip-doc">
      <header className="payslip-doc-head">
        <div><span className="payslip-doc-kicker">Slip Gaji</span><h1>{companyName}</h1><p>Periode {period}</p></div>
        <span className={`status-pill ${slip.status === "final" ? "green" : "orange"}`}><i/>{slip.status === "final" ? "Terkunci" : "Draft — dapat berubah"}</span>
      </header>
      <section className="payslip-doc-info">
        <Info label="Nama" value={slip.employee.name}/>
        <Info label="NIK" value={slip.employee.employeeCode}/>
        <Info label="Jabatan" value={slip.employee.position}/>
        <Info label="Divisi" value={slip.employee.department}/>
        <Info label="Basis gaji" value={`${basisLabels[slip.basis]} · ${rupiah(slip.baseRate)}`}/>
      </section>
      <section className="payslip-doc-attendance">
        <Stat label="Hari kerja" value={`${summary.workingDays} hari`}/>
        <Stat label="Hadir" value={`${summary.daysWorked} hari`} hint={[summary.lateDays ? `${summary.lateDays}x terlambat${summary.lateMinutes ? ` · ${formatDuration(summary.lateMinutes / 60)}` : ""}` : "", summary.missingCheckouts ? `${summary.missingCheckouts}x lupa check-out` : ""].filter(Boolean).join(" · ") || undefined}/>
        <Stat label="Izin dibayar" value={`${summary.paidLeaveDays} hari`}/>
        <Stat label="Izin tidak dibayar" value={`${summary.unpaidLeaveDays} hari`} warn={summary.unpaidLeaveDays > 0}/>
        <Stat label="Alpa" value={`${summary.absentDays} hari`} warn={summary.absentDays > 0}/>
        <Stat label={slip.basis === "hourly" ? "Jam kerja" : "Lembur"} value={formatDuration(slip.basis === "hourly" ? summary.workedHours : summary.overtimeHours)}/>
      </section>
      <div className="payslip-doc-columns">
        <Lines title="Pendapatan" lines={slip.earnings} total={slip.grossPay}/>
        <Lines title="Potongan" lines={slip.deductions} total={slip.totalDeductions}/>
      </div>
      <footer className="payslip-doc-net"><span>Gaji Bersih Diterima</span><strong>{rupiah(slip.netPay)}</strong></footer>
      <p className="payslip-doc-note">
        {slip.basis === "monthly"
          ? "Hari kerja mengikuti jadwal kerja divisi. Izin/cuti tidak dibayar dipotong sebesar gaji pokok dibagi jumlah hari kerja bulan ini; alpa dan terlambat dipotong sesuai pengaturan perhitungan gaji perusahaan."
          : "Upah dihitung dari kehadiran nyata. Izin/cuti dibayar tetap diupah, sedangkan izin tidak dibayar dan alpa tidak diupah."}
        {" "}Jam kerja sudah dikurangi jam istirahat; hari yang lupa check-out dihitung sampai jam pulang jadwal. Komponen per hari mengikuti hari hadir, dan komponen per jam mengikuti jam kerja.
      </p>
    </article>
  </>;
}

function Info({ label, value }: { label: string; value: string }) { return <div><small>{label}</small><strong>{value || "—"}</strong></div>; }
function Stat({ label, value, hint, warn }: { label: string; value: string; hint?: string; warn?: boolean }) { return <div className={warn ? "warn" : ""}><small>{label}</small><strong>{value}</strong>{hint ? <em>{hint}</em> : null}</div>; }
function Lines({ title, lines, total }: { title: string; lines: PayslipLine[]; total: number }) {
  return <section className="payslip-lines"><h2>{title}</h2>
    {lines.length ? <ul>{lines.map((line, index) => <li key={`${line.name}-${index}`}><span><strong>{line.name}</strong><small>{line.unit === "jam" ? formatDuration(line.quantity) : `${number.format(line.quantity)} ${line.unit}`} × {rupiah(line.rate)}</small></span><b>{rupiah(line.amount)}</b></li>)}</ul> : <p>Tidak ada {title.toLowerCase()}.</p>}
    <div className="payslip-lines-total"><span>Total {title.toLowerCase()}</span><strong>{rupiah(total)}</strong></div>
  </section>;
}
