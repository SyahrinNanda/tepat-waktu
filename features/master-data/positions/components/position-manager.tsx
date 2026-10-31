"use client";

import { useMemo, useState } from "react";
import { Pencil, Plus, RotateCcw, Search, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Drawer, MasterShell } from "@/features/master-data/shifts/components/shift-manager";

export type PositionRow = { id: string; name: string; active: boolean; employeeCount: number };

export function PositionManager({ initialRows, canManage }: { initialRows: PositionRow[]; canManage: boolean }) {
  const [rows, setRows] = useState(initialRows);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<PositionRow | null | undefined>();
  const [deleteTarget, setDeleteTarget] = useState<PositionRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const filtered = useMemo(() => rows.filter((row) => row.name.toLowerCase().includes(query.toLowerCase())), [rows, query]);

  async function save(form: FormData) {
    setBusy(true); setError("");
    try {
      const body = { name: String(form.get("name")), active: editing?.active ?? true };
      const response = await fetch(editing ? `/api/master/positions/${editing.id}` : "/api/master/positions", { method: editing ? "PATCH" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const payload = await response.json();
      if (!response.ok) return setError(payload.error ?? "Gagal menyimpan jabatan.");
      setRows((current) => editing ? current.map((row) => row.id === payload.row.id ? payload.row : row) : [...current, payload.row].sort((a, b) => a.name.localeCompare(b.name)));
      setEditing(undefined);
    } catch { setError("Server tidak dapat dihubungi."); } finally { setBusy(false); }
  }

  async function toggle(row: PositionRow) {
    const response = await fetch(`/api/master/positions/${row.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: row.name, active: !row.active }) });
    const payload = await response.json();
    if (response.ok) setRows((current) => current.map((item) => item.id === row.id ? payload.row : item)); else setError(payload.error);
  }

  async function remove() {
    if (!deleteTarget) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/master/positions/${deleteTarget.id}`, { method: "DELETE" });
      const payload = await response.json();
      if (!response.ok) return setError(payload.error ?? "Jabatan belum dapat dihapus.");
      setRows((current) => current.filter((item) => item.id !== deleteTarget.id));
      setDeleteTarget(null);
    } finally { setBusy(false); }
  }

  return <MasterShell title="DAFTAR JABATAN" breadcrumb="Beranda / Manajemen Jabatan / Daftar Jabatan">
    <section className="master-reference-card">
      <div className="master-toolbar"><div className="master-search"><Search size={16}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nama Jabatan..."/></div><button className="master-reset" onClick={() => setQuery("")}><RotateCcw size={17}/></button><span/>{canManage && <button className="btn btn-primary master-add" onClick={() => { setError(""); setEditing(null); }}><Plus size={17}/> Tambah Jabatan</button>}</div>
      {error && editing === undefined && <div className="announcement-inline-error">{error}</div>}
      <table className="master-reference-table"><thead><tr><th>#</th><th>Nama Jabatan</th><th>Karyawan</th><th>Status</th>{canManage && <th>Aksi</th>}</tr></thead><tbody>
        {filtered.map((row, index) => <tr key={row.id}><td>{index + 1}</td><td><strong>{row.name}</strong></td><td>{row.employeeCount}</td><td><button className={`master-toggle ${row.active ? "active" : ""}`} onClick={() => canManage && toggle(row)} disabled={!canManage}><i/><span>{row.active ? "Aktif" : "Nonaktif"}</span></button></td>{canManage && <td><div className="master-actions"><button onClick={() => setEditing(row)}><Pencil size={14}/> Edit</button><button className="danger" onClick={() => setDeleteTarget(row)}><Trash2 size={14}/> Hapus</button></div></td>}</tr>)}
        {!filtered.length && <tr><td colSpan={5}><div className="master-empty">Belum ada jabatan.</div></td></tr>}
      </tbody></table>
    </section>
    {editing !== undefined && <Drawer title={editing ? "Edit Jabatan" : "Tambah Jabatan"} onClose={() => setEditing(undefined)}><form action={save} className="drawer-form"><label>Nama Jabatan<input name="name" defaultValue={editing?.name ?? ""} placeholder="Nama Jabatan..." required autoFocus/></label>{error && <div className="announcement-inline-error">{error}</div>}<footer><button type="button" className="btn btn-outline btn-sm" onClick={() => setEditing(undefined)}>Batal</button><button className="btn btn-primary btn-sm" disabled={busy}>{busy ? "Menyimpan..." : "Simpan"}</button></footer></form></Drawer>}
    <ConfirmDialog open={Boolean(deleteTarget)} title="Hapus Jabatan?" message={`Jabatan “${deleteTarget?.name ?? ""}” akan dihapus permanen.`} busy={busy} onCancel={() => setDeleteTarget(null)} onConfirm={remove}/>
  </MasterShell>;
}
