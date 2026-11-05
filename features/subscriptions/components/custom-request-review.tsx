"use client";

import { useActionState, useState } from "react";
import { AlertTriangle, Handshake, X } from "lucide-react";
import { CUSTOM_MIN_EMPLOYEES, CUSTOM_PRICE_FLOOR, DURATION_OPTIONS, formatRupiah } from "../plan-rules";
import { reviewCustomPlanRequest, type CustomPlanState } from "../server/custom-plan-actions";

export type CustomRequestReviewRow = {
  id: string;
  companyName: string;
  requesterName: string;
  requesterEmail: string;
  employeeCount: number;
  proposedPricePerEmployee: number;
  durationMonths: number;
  note: string | null;
  status: string;
  agreedEmployeeCount: number | null;
  agreedPricePerEmployee: number | null;
  reviewNote: string | null;
  createdAt: string;
};

const idle: CustomPlanState = { status: "idle", message: "" };
const statusLabel: Record<string, string> = { pending: "Menunggu", approved: "Disetujui", rejected: "Ditolak", cancelled: "Dibatalkan" };
const statusTone: Record<string, string> = { pending: "orange", approved: "green", rejected: "red", cancelled: "gray" };
const day = (value: string) => new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeZone: "Asia/Makassar" }).format(new Date(value));

function ReviewModal({ row, onClose }: { row: CustomRequestReviewRow; onClose: () => void }) {
  const [state, action, pending] = useActionState(reviewCustomPlanRequest, idle);
  const [employees, setEmployees] = useState(row.employeeCount);
  const [price, setPrice] = useState(row.proposedPricePerEmployee);
  const [months, setMonths] = useState(row.durationMonths);
  const monthly = (employees || 0) * (price || 0);
  if (state.status === "success") {
    return <div className="standard-modal-overlay" onClick={onClose}><div className="standard-modal-card" style={{ maxWidth: 460 }} onClick={(event) => event.stopPropagation()}>
      <header className="standard-modal-header"><div><h2>Selesai</h2><p>{state.message}</p></div><button className="icon-button" type="button" onClick={onClose} aria-label="Tutup"><X size={18} /></button></header>
      <footer className="standard-modal-footer"><button className="btn btn-primary" type="button" onClick={onClose}>Tutup</button></footer>
    </div></div>;
  }
  return <div className="standard-modal-overlay" onClick={onClose}>
    <div className="standard-modal-card" style={{ maxWidth: 560 }} onClick={(event) => event.stopPropagation()}>
      <header className="standard-modal-header"><div><h2>Negosiasi Paket Custom</h2><p>{row.companyName} · diajukan {day(row.createdAt)}</p></div><button className="icon-button" type="button" onClick={onClose} aria-label="Tutup"><X size={18} /></button></header>
      <form action={action}>
        <div className="standard-modal-body">
          <input type="hidden" name="id" value={row.id} />
          <div className="custom-plan-proposal">
            <span>Diajukan<strong>{row.employeeCount.toLocaleString("id-ID")} karyawan × {formatRupiah(row.proposedPricePerEmployee)}</strong></span>
            <span>Kontak<strong>{row.requesterName}</strong><small>{row.requesterEmail}</small></span>
          </div>
          {row.note ? <p className="custom-plan-note">“{row.note}”</p> : null}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <label className="field"><span className="field-label">Karyawan disepakati</span><input className="input" name="agreedEmployeeCount" type="number" min={CUSTOM_MIN_EMPLOYEES} value={employees} onChange={(event) => setEmployees(Number(event.target.value))} /></label>
            <label className="field"><span className="field-label">Harga / karyawan (min {formatRupiah(CUSTOM_PRICE_FLOOR)})</span><input className="input" name="agreedPricePerEmployee" type="number" min={CUSTOM_PRICE_FLOOR} step={50} value={price} onChange={(event) => setPrice(Number(event.target.value))} /></label>
          </div>
          <label className="field"><span className="field-label">Durasi kontrak</span><select className="input" name="durationMonths" value={months} onChange={(event) => setMonths(Number(event.target.value))}>{DURATION_OPTIONS.map((value) => <option key={value} value={value}>{value} Bulan</option>)}</select></label>
          <label className="field"><span className="field-label">Catatan untuk perusahaan</span><textarea className="input" name="reviewNote" rows={2} maxLength={1000} placeholder="Wajib diisi bila menolak, misalnya alasan atau penawaran balik" /></label>
          <div className="custom-plan-estimate"><span>Tagihan per bulan<strong>{formatRupiah(monthly)}</strong></span><span>Invoice {months} bulan<strong>{formatRupiah(monthly * months)}</strong></span></div>
          {price > 0 && price < CUSTOM_PRICE_FLOOR ? <p className="subscription-form-error" role="alert">Harga di bawah batas bawah {formatRupiah(CUSTOM_PRICE_FLOOR)}.</p> : null}
          {state.status === "error" ? <div className="plan-inline-error" role="alert"><AlertTriangle size={18} /><span><strong>Gagal</strong><small>{state.message}</small></span></div> : null}
        </div>
        <footer className="standard-modal-footer">
          <button type="submit" name="decision" value="rejected" className="btn btn-outline" disabled={pending}>Tolak</button>
          <button type="submit" name="decision" value="approved" className="btn btn-primary" disabled={pending || price < CUSTOM_PRICE_FLOOR}>{pending ? "Memproses..." : "Setujui & Buat Invoice"}</button>
        </footer>
      </form>
    </div>
  </div>;
}

export function CustomRequestReview({ rows }: { rows: CustomRequestReviewRow[] }) {
  const [selected, setSelected] = useState<CustomRequestReviewRow | null>(null);
  const pendingCount = rows.filter((row) => row.status === "pending").length;
  return <section className="module-card custom-plan-history" id="paket-custom">
    <div className="card-head"><div><h2 className="card-title"><Handshake size={18} /> Pengajuan Paket Custom</h2><p className="card-subtitle">Perusahaan &gt; {(CUSTOM_MIN_EMPLOYEES - 1).toLocaleString("id-ID")} karyawan · harga nego, batas bawah {formatRupiah(CUSTOM_PRICE_FLOOR)}/karyawan · {pendingCount} menunggu</p></div></div>
    {rows.length ? <div className="table-wrap"><table className="table">
      <thead><tr><th>Perusahaan</th><th>Karyawan</th><th>Harga / karyawan</th><th>Per bulan</th><th>Durasi</th><th>Status</th><th /></tr></thead>
      <tbody>{rows.map((row) => {
        const employees = row.agreedEmployeeCount ?? row.employeeCount;
        const price = row.agreedPricePerEmployee ?? row.proposedPricePerEmployee;
        return <tr key={row.id}>
          <td><strong>{row.companyName}</strong><br /><small>{day(row.createdAt)}</small></td>
          <td>{employees.toLocaleString("id-ID")}</td>
          <td>{formatRupiah(price)}{row.agreedPricePerEmployee ? <small className="custom-plan-agreed"> disepakati</small> : null}</td>
          <td>{formatRupiah(employees * price)}</td>
          <td>{row.durationMonths} Bulan</td>
          <td><span className={`badge ${statusTone[row.status] ?? "gray"}`}>{statusLabel[row.status] ?? row.status}</span></td>
          <td>{row.status === "pending" ? <button className="btn btn-primary btn-sm" type="button" onClick={() => setSelected(row)}>Tinjau</button> : null}</td>
        </tr>;
      })}</tbody>
    </table></div> : <div className="empty-state"><Handshake size={26} /><strong>Belum ada pengajuan</strong><span>Pengajuan Paket Custom dari perusahaan akan muncul di sini.</span></div>}
    {selected ? <ReviewModal key={selected.id} row={selected} onClose={() => setSelected(null)} /> : null}
  </section>;
}
