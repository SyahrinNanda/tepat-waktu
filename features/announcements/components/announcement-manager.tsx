"use client";

import Image from "next/image";
import { useMemo, useRef, useState } from "react";
import { Bold, ImagePlus, Italic, Pencil, Plus, Redo2, RotateCcw, Search, Strikethrough, Trash2, Underline, Undo2, X } from "lucide-react";
import { ConfirmDialog } from "@/components/confirm-dialog";

type Announcement = { id: string; imageAssetId: string | null; title: string; summary: string; content: string; status: string; createdAt: string; updatedAt: string };

export function AnnouncementManager({ initialRows, canManage }: { initialRows: Announcement[]; canManage: boolean }) {
  const [rows, setRows] = useState(initialRows);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Announcement | null | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<Announcement | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const filtered = useMemo(() => rows.filter((row) => `${row.title} ${row.summary}`.toLowerCase().includes(query.toLowerCase())), [query, rows]);

  async function submit(form: FormData) {
    setBusy(true); setError("");
    try {
      const response = await fetch(editing ? `/api/announcements/${editing.id}` : "/api/announcements", { method: editing ? "PATCH" : "POST", body: form });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) { setError(payload.error ?? "Data belum dapat disimpan."); return; }
      const row = { ...payload.row, createdAt: new Date(payload.row.createdAt).toISOString(), updatedAt: new Date(payload.row.updatedAt).toISOString() } as Announcement;
      setRows((current) => editing ? current.map((item) => item.id === row.id ? row : item) : [row, ...current]);
      setEditing(undefined);
    } finally { setBusy(false); }
  }

  async function remove() {
    if (!deleteTarget) return;
    setBusy(true); setError("");
    const response = await fetch(`/api/announcements/${deleteTarget.id}`, { method: "DELETE" });
    if (response.ok) { setRows((current) => current.filter((item) => item.id !== deleteTarget.id)); setDeleteTarget(null); }
    else setError((await response.json().catch(() => ({}))).error ?? "Data belum dapat dihapus.");
    setBusy(false);
  }

  return <>
    <div className="announcement-page-head"><span>Presensi Admin Panel</span><h1>Daftar Pengumuman</h1></div>
    <section className="announcement-card">
      <div className="announcement-toolbar">
        <div className="announcement-search"><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari judul pengumuman ..." /></div>
        <button className="announcement-reset" type="button" aria-label="Reset pencarian" onClick={() => setQuery("")}><RotateCcw size={18} /></button>
        {canManage ? <button className="btn btn-primary announcement-add" type="button" onClick={() => { setError(""); setEditing(null); }}><Plus size={18} /> Tambah Pengumuman</button> : null}
      </div>
      {error && editing === undefined ? <div className="announcement-inline-error">{error}</div> : null}
      <div className="announcement-table-wrap"><table className="announcement-table"><thead><tr><th>#</th><th>Gambar</th><th>Judul Pengumuman</th><th>Deskripsi Singkat</th><th>Tanggal</th>{canManage ? <th>Aksi</th> : null}</tr></thead><tbody>
        {filtered.map((row, index) => <tr key={row.id}><td data-label="Nomor">{index + 1}</td><td data-label="Gambar">{row.imageAssetId ? <Image className="announcement-thumb" src={`/api/files/${row.imageAssetId}`} alt="" width={78} height={52} unoptimized /> : <span className="announcement-no-image"><ImagePlus size={18} /></span>}</td><td data-label="Judul"><strong>{row.title}</strong></td><td data-label="Deskripsi"><span className="announcement-summary">{row.summary}</span></td><td data-label="Tanggal">{new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(new Date(row.createdAt))}</td>{canManage ? <td data-label="Aksi"><div className="announcement-actions"><button type="button" onClick={() => { setError(""); setEditing(row); }} aria-label="Ubah"><Pencil size={15} /></button><button type="button" className="danger" onClick={() => setDeleteTarget(row)} aria-label="Hapus"><Trash2 size={15} /></button></div></td> : null}</tr>)}
        {!filtered.length ? <tr className="announcement-empty-row"><td colSpan={canManage ? 6 : 5}><div className="announcement-empty"><span className="loading-dots"><i /><i /><i /><i /></span><strong>{query ? "Pengumuman tidak ditemukan" : "Belum ada pengumuman"}</strong><small>{query ? "Coba gunakan kata kunci lain." : "Tambahkan pengumuman pertama untuk perusahaan ini."}</small></div></td></tr> : null}
      </tbody></table></div>
    </section>
    {editing !== undefined ? <AnnouncementModal initial={editing} busy={busy} error={error} onClose={() => setEditing(undefined)} onSubmit={submit} /> : null}
    <ConfirmDialog open={Boolean(deleteTarget)} title="Hapus Pengumuman?" message={`Pengumuman “${deleteTarget?.title ?? ""}” akan dihapus permanen.`} busy={busy} onCancel={() => setDeleteTarget(null)} onConfirm={remove}/>
  </>;
}

function AnnouncementModal({ initial, busy, error, onClose, onSubmit }: { initial: Announcement | null; busy: boolean; error: string; onClose: () => void; onSubmit: (data: FormData) => Promise<void> }) {
  const [preview, setPreview] = useState(initial?.imageAssetId ? `/api/files/${initial.imageAssetId}` : "");
  const inputRef = useRef<HTMLInputElement>(null);
  return <div className="announcement-overlay" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target && !busy) onClose(); }}><section className="announcement-modal" role="dialog" aria-modal="true" aria-labelledby="announcement-modal-title">
    <header><h2 id="announcement-modal-title">{initial ? "Ubah Pengumuman" : "Tambah Pengumuman"}</h2><button type="button" aria-label="Tutup" onClick={onClose} disabled={busy}><X size={18} /></button></header>
    <form action={onSubmit}>
      <div className="announcement-modal-body">
        <input ref={inputRef} type="file" name="image" accept="image/jpeg,image/png,image/webp" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) setPreview(URL.createObjectURL(file)); }} />
        <button className="announcement-upload" type="button" onClick={() => inputRef.current?.click()}>{preview ? <Image src={preview} alt="Pratinjau gambar" fill sizes="310px" unoptimized /> : <><ImagePlus size={31} /><span>Upload gambar pengumuman</span><b>Cari Gambar</b></>}</button>
        <label className="announcement-field"><span>Judul Pengumuman</span><input name="title" defaultValue={initial?.title ?? ""} placeholder="Ketik judul pengumuman disini" required maxLength={160} /></label>
        <label className="announcement-field"><span>Deskripsi Singkat Pengumuman</span><input name="summary" defaultValue={initial?.summary ?? ""} placeholder="Ketik deskripsi singkat disini" required maxLength={320} /></label>
        <label className="announcement-field"><span>Deskripsi Pengumuman</span><div className="announcement-editor"><div className="announcement-editor-tools"><button type="button"><Undo2 size={15} /></button><button type="button"><Redo2 size={15} /></button><button type="button"><Bold size={15} /></button><button type="button"><Italic size={15} /></button><button type="button"><Underline size={15} /></button><button type="button"><Strikethrough size={15} /></button><span>Styles</span><span>Format</span></div><textarea name="content" defaultValue={initial?.content ?? ""} required maxLength={30000} aria-label="Deskripsi pengumuman" /></div></label>
        {error ? <div className="announcement-inline-error">{error}</div> : null}
      </div>
      <footer><button className="btn btn-outline btn-sm" type="button" onClick={onClose} disabled={busy}>Batalkan</button><button className="btn btn-primary btn-sm" type="submit" disabled={busy}>{busy ? "Menyimpan..." : "Simpan"}</button></footer>
    </form>
  </section></div>;
}
