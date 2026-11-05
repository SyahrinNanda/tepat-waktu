"use client";

import { useActionState, useEffect, useState } from "react";
import { AlertTriangle, Building2, CheckCircle2, Handshake, X } from "lucide-react";
import { CUSTOM_MIN_EMPLOYEES, CUSTOM_PRICE_FLOOR, DURATION_OPTIONS, formatRupiah } from "../plan-rules";
import { cancelCustomPlanRequest, submitCustomPlanRequest, type CustomPlanState } from "../server/custom-plan-actions";

export type CustomRequestRow = {
  id: string;
  employeeCount: number;
  proposedPricePerEmployee: number;
  durationMonths: number;
  status: string;
  agreedEmployeeCount: number | null;
  agreedPricePerEmployee: number | null;
  reviewNote: string | null;
  createdAt: string;
};

const idle: CustomPlanState = { status: "idle", message: "" };
const statusLabel: Record<string, string> = { pending: "Menunggu negosiasi", approved: "Disetujui", rejected: "Ditolak", cancelled: "Dibatalkan" };
const statusTone: Record<string, string> = { pending: "orange", approved: "green", rejected: "red", cancelled: "gray" };
const day = (value: string) => new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeZone: "Asia/Makassar" }).format(new Date(value));

function CustomPlanModal({ onClose }: { onClose: () => void }) {
  const [state, action, pending] = useActionState(submitCustomPlanRequest, idle);
  const [employees, setEmployees] = useState(CUSTOM_MIN_EMPLOYEES);
  const [price, setPrice] = useState(CUSTOM_PRICE_FLOOR);
  const [months, setMonths] = useState(12);
  useEffect(() => { if (state.status === "success") onClose(); }, [state.status, onClose]);
  const monthly = (employees || 0) * (price || 0);
  return <div className="subscription-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className="subscription-dialog duration-dialog plan-duration-dialog" role="dialog" aria-modal="true" aria-labelledby="custom-plan-title">
      <header><span className="plan-dialog-title-icon"><Handshake size={18} /></span><div><small>PAKET CUSTOM</small><h2 id="custom-plan-title">Ajukan Paket Custom</h2></div><button type="button" onClick={onClose} aria-label="Tutup"><X size={19} /></button></header>
      <form action={action}>
        <div className="subscription-dialog-body custom-plan-form">
          <p>Untuk perusahaan dengan lebih dari {(CUSTOM_MIN_EMPLOYEES - 1).toLocaleString("id-ID")} karyawan. Harga per karyawan bisa dinegosiasikan, minimal {formatRupiah(CUSTOM_PRICE_FLOOR)}.</p>
          <label className="plan-duration-field"><span>Jumlah karyawan</span><input className="input" name="employeeCount" type="number" min={CUSTOM_MIN_EMPLOYEES} step={1} required value={employees} onChange={(event) => setEmployees(Number(event.target.value))} /></label>
          <label className="plan-duration-field"><span>Harga yang diajukan per karyawan / bulan (Rp)</span><input className="input" name="proposedPricePerEmployee" type="number" min={CUSTOM_PRICE_FLOOR} step={50} required value={price} onChange={(event) => setPrice(Number(event.target.value))} /></label>
          <label className="plan-duration-field"><span>Durasi kontrak</span><select name="durationMonths" value={months} onChange={(event) => setMonths(Number(event.target.value))}>{DURATION_OPTIONS.map((value) => <option key={value} value={value}>{value} Bulan</option>)}</select></label>
          <label className="plan-duration-field"><span>Catatan (opsional)</span><textarea className="input" name="note" rows={3} maxLength={1000} placeholder="Contoh: jumlah cabang, kebutuhan integrasi, kontak PIC" /></label>
          <div className="custom-plan-estimate" aria-live="polite">
            <span>Perkiraan per bulan<strong>{formatRupiah(monthly)}</strong></span>
            <span>Perkiraan {months} bulan<strong>{formatRupiah(monthly * months)}</strong></span>
          </div>
          {state.status === "error" && <div className="plan-inline-error" role="alert"><AlertTriangle size={18} /><span><strong>Pengajuan gagal</strong><small>{state.message}</small></span></div>}
        </div>
        <footer><button type="button" className="plan-dialog-cancel" onClick={onClose}>Batal</button><button className="subscription-blue-button" type="submit" disabled={pending}>{pending ? "MENGIRIM..." : "KIRIM PENGAJUAN"}</button></footer>
      </form>
    </section>
  </div>;
}

/** The "Custom" tier card on Daftar Paket. */
export function CustomPlanCard({ canManage, requests }: { canManage: boolean; requests: CustomRequestRow[] }) {
  const [open, setOpen] = useState(false);
  const hasPending = requests.some((request) => request.status === "pending");
  return <>
    <article className="subscription-plan-reference custom-plan-reference" id="paket-custom">
      <header><Building2 size={23} /><strong>PAKET CUSTOM</strong><span>NEGO</span></header>
      <div>
        <h2>{formatRupiah(CUSTOM_PRICE_FLOOR)}<small>/ karyawan</small></h2>
        <button type="button" className="primary" disabled={!canManage || hasPending} onClick={() => setOpen(true)}>{hasPending ? "Pengajuan Diproses" : canManage ? "Ajukan Paket Custom" : "Hubungi Admin"}</button>
        <label>APA YANG ANDA PEROLEH</label>
        <ul>
          <li><CheckCircle2 size={14} />Lebih dari {(CUSTOM_MIN_EMPLOYEES - 1).toLocaleString("id-ID")} karyawan</li>
          <li><CheckCircle2 size={14} />Harga per karyawan bisa dinegosiasikan (mulai {formatRupiah(CUSTOM_PRICE_FLOOR)})</li>
          <li><CheckCircle2 size={14} />Pendampingan khusus dari tim TepatWaktu</li>
        </ul>
      </div>
    </article>
    {open && <CustomPlanModal onClose={() => setOpen(false)} />}
  </>;
}

export function CustomPlanHistory({ canManage, requests }: { canManage: boolean; requests: CustomRequestRow[] }) {
  if (!requests.length) return null;
  return <section className="module-card custom-plan-history">
      <h2>Riwayat Pengajuan Paket Custom</h2>
      <div className="table-wrap"><table className="table">
        <thead><tr><th>Tanggal</th><th>Karyawan</th><th>Harga / karyawan</th><th>Durasi</th><th>Status</th><th>Catatan</th><th /></tr></thead>
        <tbody>{requests.map((request) => {
          const agreed = request.status === "approved";
          return <tr key={request.id}>
            <td>{day(request.createdAt)}</td>
            <td>{(agreed ? request.agreedEmployeeCount ?? request.employeeCount : request.employeeCount).toLocaleString("id-ID")}</td>
            <td>{formatRupiah(agreed ? request.agreedPricePerEmployee ?? request.proposedPricePerEmployee : request.proposedPricePerEmployee)}{agreed ? <small className="custom-plan-agreed"> disepakati</small> : null}</td>
            <td>{request.durationMonths} Bulan</td>
            <td><span className={`badge ${statusTone[request.status] ?? "gray"}`}>{statusLabel[request.status] ?? request.status}</span></td>
            <td>{agreed ? "Invoice tersedia di menu Langganan." : request.reviewNote ?? "—"}</td>
            <td>{request.status === "pending" && canManage ? <form action={cancelCustomPlanRequest}><input type="hidden" name="id" value={request.id} /><button className="btn btn-outline btn-sm" type="submit">Batalkan</button></form> : null}</td>
          </tr>;
        })}</tbody>
      </table></div>
    </section>;
}
