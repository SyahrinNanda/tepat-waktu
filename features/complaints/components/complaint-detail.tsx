"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowLeft, CheckCircle2, EyeOff, Lock, Save } from "lucide-react";
import { categoryLabels, statusKeys, statusLabels, type ComplaintStatus } from "../config";
import type { HandlerComplaint, ReporterComplaint } from "../server/complaint-service";
import { updateComplaint } from "../server/actions";
import { ComplaintStatusPill } from "./complaint-lists";

type Detail = (HandlerComplaint & { view: "handler" }) | (ReporterComplaint & { view: "reporter" });
const formatDate = (value: Date | string) => new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "long", year: "numeric" }).format(new Date(value));

export function ComplaintDetail({ complaint, justCreated }: { complaint: Detail; justCreated: boolean }) {
  return <>
    <div className="payslip-actions"><Link className="btn btn-outline btn-compact" href="/dashboard/karyawan/keluhan"><ArrowLeft size={15}/> Kembali</Link></div>
    {justCreated && <div className="complaint-success"><CheckCircle2 size={20}/><div><strong>Laporan terkirim dengan kode {complaint.ticketCode}</strong><span>Simpan kode ini. Anda bisa memantau status dan tanggapan penangan di halaman ini kapan saja.</span></div></div>}
    <section className="detail-layout">
      <article className="module-card detail-section complaint-detail">
        <header><span className="eyebrow">{complaint.ticketCode} · {categoryLabels[complaint.category]}</span><h1>{complaint.title}</h1>
          <div className="tenant-chips"><ComplaintStatusPill status={complaint.status}/><span className="tenant-chip">Dilaporkan {formatDate(complaint.createdAt)}</span>{complaint.anonymous ? <span className="tenant-chip"><EyeOff size={13}/>Anonim</span> : complaint.view === "handler" && complaint.reporterName ? <span className="tenant-chip">Pelapor: {complaint.reporterName}</span> : null}</div>
        </header>
        <p className="complaint-description">{complaint.description}</p>
        <div className="detail-grid">
          <div className="detail-field"><small>Tanggal kejadian</small><strong>{complaint.incidentDate ? formatDate(complaint.incidentDate) : "—"}</strong></div>
          <div className="detail-field"><small>Lokasi</small><strong>{complaint.incidentLocation ?? "—"}</strong></div>
          <div className="detail-field"><small>Pihak terlibat</small><strong>{complaint.involvedParties ?? "—"}</strong></div>
        </div>
        {complaint.view === "reporter" && <section className="complaint-response">
          <h2>Tanggapan penangan</h2>
          {complaint.responseNote ? <><p>{complaint.responseNote}</p>{complaint.handledAt && <small>Diperbarui {formatDate(complaint.handledAt)}</small>}</> : <p className="muted">Belum ada tanggapan. Laporan Anda akan ditinjau oleh Admin atau HRD.</p>}
        </section>}
      </article>
      {complaint.view === "handler" && <HandlerPanel complaint={complaint}/>}
    </section>
  </>;
}

function HandlerPanel({ complaint }: { complaint: HandlerComplaint }) {
  const router = useRouter();
  const [status, setStatus] = useState<ComplaintStatus>(complaint.status);
  const [responseNote, setResponseNote] = useState(complaint.responseNote ?? "");
  const [internalNote, setInternalNote] = useState(complaint.internalNote ?? "");
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null), [pending, start] = useTransition();
  function save() {
    setMessage(null);
    start(async () => {
      const result = await updateComplaint({ id: complaint.id, status, responseNote, internalNote });
      if (!result.ok) return setMessage({ type: "error", text: result.error });
      setMessage({ type: "ok", text: "Tindak lanjut tersimpan." });
      router.refresh();
    });
  }
  return <aside className="detail-side"><section className="module-card detail-action-card complaint-handle">
    <span className="eyebrow">Penanganan</span><h2>Tindak lanjut</h2>
    <label className="field"><span className="field-label">Status</span><select className="input" value={status} onChange={(event) => setStatus(event.target.value as ComplaintStatus)}>{statusKeys.map((key) => <option key={key} value={key}>{statusLabels[key]}</option>)}</select></label>
    <label className="field"><span className="field-label">Tanggapan untuk pelapor</span><textarea className="input" rows={4} maxLength={3000} value={responseNote} onChange={(event) => setResponseNote(event.target.value)} placeholder="Dapat dibaca oleh pelapor, termasuk pelapor anonim."/></label>
    <label className="field"><span className="field-label"><Lock size={12}/> Catatan internal</span><textarea className="input" rows={4} maxLength={3000} value={internalNote} onChange={(event) => setInternalNote(event.target.value)} placeholder="Hanya terlihat oleh Admin dan HRD."/></label>
    {message && <div className={message.type === "ok" ? "complaint-saved" : "announcement-inline-error"} role="status">{message.text}</div>}
    <button className="btn btn-primary btn-block" disabled={pending} onClick={save}><Save size={15}/> {pending ? "Menyimpan..." : "Simpan Tindak Lanjut"}</button>
  </section></aside>;
}
