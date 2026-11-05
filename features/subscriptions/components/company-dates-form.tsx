"use client";

import { useActionState, useState } from "react";
import { AlertTriangle, CalendarClock, CheckCircle2 } from "lucide-react";
import { updateCompanyDates, type CompanyDatesState } from "../server/date-actions";

const idle: CompanyDatesState = { status: "idle", message: "" };

/** Superadmin form for a company's registration date and subscription due date (WITA). */
export function CompanyDatesForm({ companyId, registeredAt, dueAt, hasRunningOrder, planName }: {
  companyId: string;
  /** yyyy-mm-dd in WITA */
  registeredAt: string;
  /** yyyy-mm-ddTHH:mm in WITA, or "" when the company has no due date */
  dueAt: string;
  hasRunningOrder: boolean;
  planName: string;
}) {
  const [state, action, pending] = useActionState(updateCompanyDates, idle);
  const [due, setDue] = useState(dueAt);
  // Compared as WITA wall-clock strings, which sort chronologically.
  const nowWita = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Makassar", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date()).replace(" ", "T");
  const locks = Boolean(due) && due <= nowWita;
  return <section className="module-card detail-action-card company-dates-card">
    <span className="eyebrow">Tanggal penting</span>
    <h2><CalendarClock size={18} /> Terdaftar & Jatuh Tempo</h2>
    <form action={action} className="company-plan-form">
      <input type="hidden" name="companyId" value={companyId} />
      <label className="field"><span className="field-label">Tanggal terdaftar</span><input className="input" type="date" name="registeredAt" defaultValue={registeredAt} max={nowWita.slice(0, 10)} required /></label>
      <label className="field"><span className="field-label">Jatuh tempo langganan (WITA)</span><input className="input" type="datetime-local" name="dueAt" value={due} onChange={(event) => setDue(event.target.value)} /></label>
      <p className="company-dates-hint">{hasRunningOrder
        ? `Mengubah masa berakhir Paket ${planName} yang sedang tercatat. Email pengingat H-5 / H-2 dihitung ulang dari tanggal baru.`
        : `Perusahaan belum punya langganan berjalan. Mengisi jatuh tempo akan membuka akses gratis dengan Paket ${planName} sampai tanggal tersebut.`}</p>
      {locks ? <p className="company-dates-warning" role="alert"><AlertTriangle size={15} /> Jatuh tempo sudah lewat: setelah disimpan, akses semua akun perusahaan ini langsung terkunci.</p> : null}
      {state.status === "success" ? <p className="company-dates-success" role="status"><CheckCircle2 size={15} /> {state.message}</p> : null}
      {state.status === "error" ? <p className="company-dates-warning" role="alert"><AlertTriangle size={15} /> {state.message}</p> : null}
      <button className="btn btn-primary btn-block" type="submit" disabled={pending}>{pending ? "Menyimpan..." : "Simpan Tanggal"}</button>
    </form>
  </section>;
}
