"use client";

import { useActionState, useMemo, useState } from "react";
import { ModalPortal } from "@/components/modal-portal";
import { AlertTriangle, CheckCircle2, Pencil, Plus, X } from "lucide-react";
import { saveAnnouncement, type AnnouncementFormState } from "../server/announcement-actions";
import { PlatformAnnouncements } from "./platform-announcements";

export type AnnouncementDraft = {
  id: string; title: string; message: string; tone: "info" | "feature" | "maintenance" | "warning"; audience: "all" | "admins";
  companyIds: string[] | null; linkUrl: string | null; linkLabel: string | null; startsAt: string; endsAt: string;
};
type CompanyOption = { id: string; name: string };
const idle: AnnouncementFormState = { status: "idle", message: "" };

export function AnnouncementButton({ companies, draft }: { companies: CompanyOption[]; draft?: AnnouncementDraft }) {
  const [open, setOpen] = useState(false);
  return <>
    {draft
      ? <button className="btn btn-outline btn-sm" type="button" onClick={() => setOpen(true)}><Pencil size={13} /> Ubah</button>
      : <button className="btn btn-primary" type="button" onClick={() => setOpen(true)}><Plus size={16} /> Buat Pengumuman</button>}
    {open ? <ModalPortal><AnnouncementModal companies={companies} draft={draft} onClose={() => setOpen(false)} /></ModalPortal> : null}
  </>;
}

function AnnouncementModal({ companies, draft, onClose }: { companies: CompanyOption[]; draft?: AnnouncementDraft; onClose: () => void }) {
  const [state, action, pending] = useActionState(saveAnnouncement, idle);
  const [title, setTitle] = useState(draft?.title ?? "");
  const [message, setMessage] = useState(draft?.message ?? "");
  const [tone, setTone] = useState<AnnouncementDraft["tone"]>(draft?.tone ?? "info");
  const [target, setTarget] = useState<"all" | "selected">(draft?.companyIds ? "selected" : "all");
  const [picked, setPicked] = useState<Set<string>>(new Set(draft?.companyIds ?? []));
  const [search, setSearch] = useState("");
  const filtered = useMemo(() => companies.filter((company) => company.name.toLowerCase().includes(search.toLowerCase())), [companies, search]);
  const preview = useMemo(() => [{ id: "preview", title: title || "Judul pengumuman", message: message || "Isi pengumuman akan tampil di sini.", tone, linkUrl: null, linkLabel: null, version: "preview" }], [title, message, tone]);

  return <div className="standard-modal-overlay" onClick={onClose}>
    <div className="standard-modal-card" style={{ maxWidth: 680 }} role="dialog" aria-modal="true" aria-labelledby="announcement-title" onClick={(event) => event.stopPropagation()}>
      <header className="standard-modal-header"><div><h2 id="announcement-title">{draft ? "Ubah Pengumuman" : "Buat Pengumuman Platform"}</h2><p>Tampil sebagai banner di atas dashboard perusahaan. Waktu dalam WITA.</p></div><button className="icon-button" type="button" onClick={onClose} aria-label="Tutup"><X size={18} /></button></header>
      {state.status === "success" ? <>
        <div className="standard-modal-body"><p className="retention-success"><CheckCircle2 size={18} /> {state.message}</p></div>
        <footer className="standard-modal-footer"><button className="btn btn-primary" type="button" onClick={onClose}>Selesai</button></footer>
      </> : <form action={action}>
        <div className="standard-modal-body announcement-form">
          {draft ? <input type="hidden" name="id" value={draft.id} /> : null}
          <div className="announcement-preview"><span className="field-label">Pratinjau</span><PlatformAnnouncements items={preview} /></div>
          <label className="field"><span className="field-label">Judul</span><input className="input" name="title" required maxLength={120} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Maintenance terjadwal" /></label>
          <label className="field"><span className="field-label">Isi pengumuman</span><textarea className="input" name="message" required maxLength={600} rows={3} value={message} onChange={(event) => setMessage(event.target.value)} placeholder="TepatWaktu tidak bisa diakses Sabtu, 9 Nov pukul 22.00–23.00 WITA." /></label>
          <div className="announcement-row">
            <label className="field"><span className="field-label">Jenis</span><select className="input" name="tone" value={tone} onChange={(event) => setTone(event.target.value as AnnouncementDraft["tone"])}><option value="info">Info</option><option value="feature">Fitur baru</option><option value="maintenance">Maintenance</option><option value="warning">Penting</option></select></label>
            <label className="field"><span className="field-label">Ditampilkan ke</span><select className="input" name="audience" defaultValue={draft?.audience ?? "all"}><option value="all">Semua akun</option><option value="admins">Hanya Admin Perusahaan</option></select></label>
          </div>
          <div className="announcement-row">
            <label className="field"><span className="field-label">Mulai tayang (kosong = sekarang)</span><input className="input" type="datetime-local" name="startsAt" defaultValue={draft?.startsAt ?? ""} /></label>
            <label className="field"><span className="field-label">Selesai (kosong = sampai dihentikan)</span><input className="input" type="datetime-local" name="endsAt" defaultValue={draft?.endsAt ?? ""} /></label>
          </div>
          <div className="announcement-row">
            <label className="field"><span className="field-label">Tautan (opsional)</span><input className="input" name="linkUrl" defaultValue={draft?.linkUrl ?? ""} placeholder="/dashboard/langganan atau https://…" /></label>
            <label className="field"><span className="field-label">Teks tautan</span><input className="input" name="linkLabel" maxLength={40} defaultValue={draft?.linkLabel ?? ""} placeholder="Selengkapnya" /></label>
          </div>
          <fieldset className="announcement-target">
            <legend className="field-label">Perusahaan tujuan</legend>
            <label><input type="radio" name="target" value="all" checked={target === "all"} onChange={() => setTarget("all")} /> Semua perusahaan</label>
            <label><input type="radio" name="target" value="selected" checked={target === "selected"} onChange={() => setTarget("selected")} /> Perusahaan tertentu {target === "selected" ? `(${picked.size} dipilih)` : ""}</label>
            {target === "selected" ? <div className="announcement-companies">
              <input className="input" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari perusahaan" aria-label="Cari perusahaan" />
              <div className="announcement-company-list">{filtered.map((company) => <label key={company.id}><input type="checkbox" checked={picked.has(company.id)} onChange={(event) => setPicked((current) => { const next = new Set(current); if (event.target.checked) next.add(company.id); else next.delete(company.id); return next; })} /> {company.name}</label>)}</div>
              {[...picked].map((id) => <input key={id} type="hidden" name="companyIds" value={id} />)}
            </div> : null}
          </fieldset>
          {state.status === "error" ? <div className="plan-inline-error" role="alert"><AlertTriangle size={18} /><span><strong>Gagal</strong><small>{state.message}</small></span></div> : null}
        </div>
        <footer className="standard-modal-footer"><button className="btn btn-outline" type="button" onClick={onClose}>Batal</button><button className="btn btn-primary" type="submit" disabled={pending}>{pending ? "Menyimpan..." : draft ? "Simpan Perubahan" : "Tayangkan"}</button></footer>
      </form>}
    </div>
  </div>;
}
