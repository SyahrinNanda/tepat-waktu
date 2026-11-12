"use client";
import { useState } from "react";
import { Pencil, Plus, Save, Trash2 } from "lucide-react";
import { LocationModal } from "@/features/master-data/shared/location-modal";
import { confirmAction } from "@/components/confirm-dialog";
import { SPECIAL_LEAVE_SUGGESTIONS } from "@/features/leave-requests/server/schemas";

export type SpecialLeaveKind = { id: string; name: string; durationDays: number | null; paid: boolean };
type Draft = { name: string; durationDays: string; paid: boolean };

const emptyDraft: Draft = { name: "", durationDays: "", paid: true };
const num = (value: string) => (value.trim() ? Number(value) : null);
const toBody = (draft: Draft) => ({ name: draft.name.trim(), durationDays: num(draft.durationDays), paid: draft.paid });
const toDraft = (kind: SpecialLeaveKind): Draft => ({ name: kind.name, durationDays: kind.durationDays ? String(kind.durationDays) : "", paid: kind.paid });

/** "3 hari kerja · Dibayar" */
export function describeKind(kind: Pick<SpecialLeaveKind, "durationDays" | "paid">) {
  return [
    kind.durationDays ? `${kind.durationDays} hari kerja` : "Tanggal bebas",
    kind.paid ? "Dibayar" : "Tidak dibayar",
  ].filter(Boolean).join(" · ");
}

/** Admin / GM / HRD manage the company's own kinds of Cuti Khusus (Menikah, Melahirkan, Berduka...). */
export function SpecialLeaveTypesModal({ kinds, onChange, onClose, onCreated }: {
  kinds: SpecialLeaveKind[];
  onChange: (kinds: SpecialLeaveKind[]) => void;
  onClose: () => void;
  onCreated?: (kind: SpecialLeaveKind) => void;
}) {
  const [draft, setDraft] = useState<Draft>(emptyDraft), [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const taken = new Set(kinds.map((kind) => kind.name.toLowerCase()));
  const suggestions = SPECIAL_LEAVE_SUGGESTIONS.filter((item) => !taken.has(item.name.toLowerCase()));
  const sorted = (rows: SpecialLeaveKind[]) => [...rows].sort((a, b) => a.name.localeCompare(b.name, "id"));

  async function call(url: string, method: string, body?: unknown) {
    setBusy(true); setError("");
    try {
      const response = await fetch(url, { method, headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) { setError(payload.error ?? "Gagal menyimpan jenis cuti."); return null; }
      return payload as { row?: SpecialLeaveKind };
    } catch { setError("Server tidak dapat dihubungi."); return null; } finally { setBusy(false); }
  }

  async function submit(input: Draft) {
    if (!input.name.trim()) return setError("Isi nama jenis cuti.");
    if (editingId) {
      const result = await call(`/api/leave-requests/special-types/${editingId}`, "PATCH", toBody(input));
      if (!result?.row) return;
      onChange(sorted(kinds.map((kind) => kind.id === editingId ? result.row! : kind)));
    } else {
      const result = await call("/api/leave-requests/special-types", "POST", toBody(input));
      if (!result?.row) return;
      onChange(sorted([...kinds, result.row]));
      onCreated?.(result.row);
    }
    setDraft(emptyDraft); setEditingId(null);
  }

  async function remove(kind: SpecialLeaveKind) {
    if (!await confirmAction(`Hapus jenis "${kind.name}"? Pengajuan yang sudah ada tetap tersimpan dengan nama ini, tetapi jenis ini tidak bisa dipilih lagi.`, "Hapus Jenis Cuti Khusus")) return;
    const result = await call(`/api/leave-requests/special-types/${kind.id}`, "DELETE");
    if (!result) return;
    onChange(kinds.filter((item) => item.id !== kind.id));
    if (editingId === kind.id) { setEditingId(null); setDraft(emptyDraft); }
  }

  return <LocationModal title="Jenis Cuti Khusus" onClose={onClose}>
    <div className="special-kinds">
      <p className="special-kinds-intro">Atur jenis cuti khusus perusahaan Anda. Jika <strong>durasi</strong> diisi, karyawan cukup memilih tanggal mulai dan tanggal selesai dihitung otomatis dalam <strong>hari kerja</strong> sesuai jadwal divisinya (hari libur jadwal tidak dihitung). Cuti khusus tidak mengurangi jatah cuti tahunan.</p>
      {kinds.length ? <ul className="special-kinds-list">{kinds.map((kind) => <li key={kind.id} className={editingId === kind.id ? "editing" : ""}>
        <div><strong>{kind.name}</strong><small>{describeKind(kind)}</small></div>
        <span className="special-kinds-actions">
          <button type="button" aria-label={`Edit ${kind.name}`} disabled={busy} onClick={() => { setEditingId(kind.id); setDraft(toDraft(kind)); setError(""); }}><Pencil size={14}/></button>
          <button type="button" aria-label={`Hapus ${kind.name}`} className="danger" disabled={busy} onClick={() => remove(kind)}><Trash2 size={14}/></button>
        </span>
      </li>)}</ul> : <div className="special-kinds-empty">Belum ada jenis cuti khusus. Tambahkan di bawah atau pilih dari saran.</div>}

      <form className="special-kinds-form" onSubmit={(event) => { event.preventDefault(); void submit(draft); }}>
        <h3>{editingId ? `Edit jenis: ${kinds.find((kind) => kind.id === editingId)?.name ?? ""}` : "Tambah jenis baru"}</h3>
        <div className="special-kinds-fields">
          <label className="wide">Nama jenis<input value={draft.name} maxLength={60} placeholder="Contoh: Berduka, Menikah, Melahirkan" onChange={(event) => setDraft({ ...draft, name: event.target.value })}/></label>
          <label>Durasi (hari kerja)<input type="number" min={1} max={260} placeholder="Kosong = pilih tanggal sendiri" value={draft.durationDays} onChange={(event) => setDraft({ ...draft, durationDays: event.target.value })}/></label>
          <label>Gaji<select value={draft.paid ? "paid" : "unpaid"} onChange={(event) => setDraft({ ...draft, paid: event.target.value === "paid" })}><option value="paid">Dibayar</option><option value="unpaid">Tidak dibayar</option></select></label>
        </div>
        <div className="special-kinds-form-actions">
          {editingId && <button type="button" className="btn btn-outline btn-sm" onClick={() => { setEditingId(null); setDraft(emptyDraft); setError(""); }}>Batal edit</button>}
          <button className="btn btn-primary btn-sm" disabled={busy || !draft.name.trim()}>{editingId ? <><Save size={15}/> Simpan perubahan</> : <><Plus size={15}/> Tambah jenis</>}</button>
        </div>
      </form>

      {!editingId && suggestions.length > 0 && <div className="special-kinds-suggest"><span>Saran sesuai UU Ketenagakerjaan (durasi dalam hari kerja, bisa diubah setelah ditambahkan):</span>{suggestions.map((item) => <button type="button" key={item.name} disabled={busy} onClick={() => submit({ name: item.name, durationDays: String(item.durationDays), paid: true })}><Plus size={12}/> {item.name} <small>{item.durationDays} hari</small></button>)}</div>}
      {error && <div className="announcement-inline-error">{error}</div>}
    </div>
    <footer className="special-kinds-footer"><button type="button" className="btn btn-outline btn-sm" onClick={onClose}>Selesai</button></footer>
  </LocationModal>;
}
