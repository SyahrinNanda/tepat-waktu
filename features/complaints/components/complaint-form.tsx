"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { EyeOff, Send, ShieldCheck, X } from "lucide-react";
import { categoryKeys, categoryLabels, type ComplaintCategory } from "../config";
import { submitComplaint } from "../server/actions";

export function ComplaintForm({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [anonymous, setAnonymous] = useState(true);
  const [error, setError] = useState(""), [pending, start] = useTransition();

  function submit(form: FormData) {
    setError("");
    start(async () => {
      const result = await submitComplaint({
        category: String(form.get("category")) as ComplaintCategory,
        title: String(form.get("title") ?? ""),
        description: String(form.get("description") ?? ""),
        incidentDate: String(form.get("incidentDate") ?? ""),
        incidentLocation: String(form.get("incidentLocation") ?? ""),
        involvedParties: String(form.get("involvedParties") ?? ""),
        anonymous,
      });
      if (!result.ok) return setError(result.error);
      router.push(`/dashboard/karyawan/keluhan/${result.id}?baru=1`);
    });
  }

  return <div className="standard-modal-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !pending) onClose(); }}>
    <section className="standard-modal-card complaint-modal" role="dialog" aria-modal="true" aria-labelledby="complaint-form-title">
      <header className="standard-modal-header"><div><h2 id="complaint-form-title">Buat Laporan Keluhan</h2><p>Laporan hanya dapat dibaca oleh Admin Perusahaan dan HRD.</p></div><button type="button" className="icon-button" onClick={onClose} aria-label="Tutup"><X size={18}/></button></header>
      <form action={submit}>
        <div className="standard-modal-body complaint-form">
          <div className={`complaint-anon ${anonymous ? "on" : ""}`}>
            <span>{anonymous ? <EyeOff size={20}/> : <ShieldCheck size={20}/>}</span>
            <div><strong>{anonymous ? "Kirim secara anonim" : "Kirim dengan nama saya"}</strong><small>{anonymous ? "Nama dan akun Anda tidak disimpan di laporan. Anda tetap bisa memantau laporan ini dari akun Anda." : "Nama Anda terlihat oleh penangan, sehingga mereka dapat menghubungi Anda untuk klarifikasi."}</small></div>
            <label className="ui-switch"><input type="checkbox" checked={anonymous} onChange={(event) => setAnonymous(event.target.checked)} aria-label="Kirim secara anonim"/><span className="ui-switch-slider"/></label>
          </div>
          <label className="field"><span className="field-label">Jenis keluhan *</span><select className="input" name="category" required defaultValue="">{[<option key="" value="" disabled>Pilih jenis keluhan</option>, ...categoryKeys.map((key) => <option key={key} value={key}>{categoryLabels[key]}</option>)]}</select></label>
          <label className="field"><span className="field-label">Judul singkat *</span><input className="input" name="title" required minLength={5} maxLength={150} placeholder="Contoh: Perkataan merendahkan saat rapat tim"/></label>
          <label className="field"><span className="field-label">Ceritakan kejadiannya *</span><textarea className="input" name="description" required minLength={20} maxLength={5000} rows={6} placeholder="Apa yang terjadi, kapan, dan bagaimana dampaknya bagi Anda. Tulis sejelas yang Anda nyaman."/></label>
          <div className="complaint-form-row">
            <label className="field"><span className="field-label">Tanggal kejadian</span><input className="input" type="date" name="incidentDate"/></label>
            <label className="field"><span className="field-label">Lokasi kejadian</span><input className="input" name="incidentLocation" maxLength={200} placeholder="Contoh: Ruang rapat lantai 2"/></label>
          </div>
          <label className="field"><span className="field-label">Pihak yang terlibat</span><input className="input" name="involvedParties" maxLength={500} placeholder="Nama, jabatan, atau ciri pihak terlibat dan saksi (opsional)"/></label>
          {anonymous && <p className="complaint-hint">Tips: kalau ingin tetap anonim, hindari menulis detail yang hanya diketahui Anda sendiri.</p>}
          {error && <div className="announcement-inline-error" role="alert">{error}</div>}
        </div>
        <footer className="standard-modal-footer"><button type="button" className="btn btn-outline btn-compact" onClick={onClose} disabled={pending}>Batal</button><button className="btn btn-primary btn-compact" disabled={pending}><Send size={15}/> {pending ? "Mengirim..." : "Kirim Laporan"}</button></footer>
      </form>
    </section>
  </div>;
}
