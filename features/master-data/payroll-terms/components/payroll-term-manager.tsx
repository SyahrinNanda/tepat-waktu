"use client";
import { useMemo, useState } from "react";
import { Pencil, Plus, RotateCcw, Search, Trash2, WalletCards } from "lucide-react";
import { Drawer, MasterShell } from "@/features/master-data/shifts/components/shift-manager";
import { confirmDelete } from "@/components/confirm-dialog";

type TermType = "compensation" | "deduction";
export type PayrollTermRow = { id: string; name: string; type: TermType; active: boolean };
const typeLabels: Record<TermType, string> = { compensation: "Kompensasi", deduction: "Potongan" };

export function PayrollTermManager({ initialRows, canManage }: { initialRows: PayrollTermRow[]; canManage: boolean }) {
  const [rows, setRows] = useState(initialRows), [query, setQuery] = useState(""), [type, setType] = useState(""), [editing, setEditing] = useState<PayrollTermRow | null | undefined>();
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const filtered = useMemo(() => rows.filter((row) => row.name.toLowerCase().includes(query.toLowerCase()) && (!type || row.type === type)), [rows, query, type]);
  async function save(form: FormData) {
    setBusy(true); setError("");
    try {
      const body = { name: String(form.get("name")), type: String(form.get("type")), active: editing?.active ?? true };
      const response = await fetch(editing ? `/api/master/payroll-terms/${editing.id}` : "/api/master/payroll-terms", { method: editing ? "PATCH" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const payload = await response.json();
      if (!response.ok) return setError(payload.error ?? "Gagal menyimpan istilah.");
      setRows((current) => editing ? current.map((row) => row.id === payload.row.id ? payload.row : row) : [...current, payload.row].sort((a, b) => a.name.localeCompare(b.name)));
      setEditing(undefined);
    } catch { setError("Server tidak dapat dihubungi."); } finally { setBusy(false); }
  }
  async function remove(row: PayrollTermRow) { if (!await confirmDelete(`Hapus istilah “${row.name}”?`)) return; const response = await fetch(`/api/master/payroll-terms/${row.id}`, { method: "DELETE" }); const payload = await response.json(); if (response.ok) setRows((current) => current.filter((item) => item.id !== row.id)); else setError(payload.error); }
  return <MasterShell title="Daftar Istilah Gaji" breadcrumb="">
    <section className="master-reference-card payroll-term-card">
      <div className="master-toolbar payroll-term-toolbar"><div className="master-search"><Search size={16}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari nama istilah..."/></div><select value={type} onChange={(event) => setType(event.target.value)}><option value="">Pilih Tipe</option><option value="compensation">Kompensasi</option><option value="deduction">Potongan</option></select><button className="master-reset" onClick={() => { setQuery(""); setType(""); }}><RotateCcw size={17}/></button><span/>{canManage && <button className="btn btn-primary master-add" onClick={() => { setError(""); setEditing(null); }}><Plus size={17}/> Tambah</button>}</div>
      {error && editing === undefined && <div className="announcement-inline-error">{error}</div>}
      <table className="master-reference-table"><thead><tr><th>#</th><th>Nama</th><th>Type</th>{canManage && <th>Aksi</th>}</tr></thead><tbody>{filtered.map((row, index) => <tr key={row.id}><td>{index + 1}</td><td><strong>{row.name}</strong></td><td><span className={`term-type ${row.type}`}>{typeLabels[row.type]}</span></td>{canManage && <td><div className="master-actions"><button onClick={() => { setError(""); setEditing(row); }}><Pencil size={14}/> Edit</button><button className="danger" onClick={() => remove(row)}><Trash2 size={14}/> Hapus</button></div></td>}</tr>)}{!filtered.length && <tr><td colSpan={4}><div className="location-empty"><WalletCards size={44}/><strong>Data Kosong</strong><span>Belum ada istilah gaji.</span></div></td></tr>}</tbody></table>
      <div className="payroll-term-footer"><span>menampilkan {filtered.length} dari {rows.length} data, Tampilkan</span><button>25</button><button>50</button><button>100</button></div>
    </section>
    {editing !== undefined && <Drawer title={editing ? "Edit Istilah" : "Tambah Istilah"} onClose={() => setEditing(undefined)}><form action={save} className="drawer-form"><label>Nama Istilah<input name="name" defaultValue={editing?.name ?? ""} placeholder="Nama..." required autoFocus/></label><label>Type Istilah<select name="type" defaultValue={editing?.type ?? ""} required><option value="" disabled>Pilih Type Istilah</option><option value="compensation">Kompensasi</option><option value="deduction">Potongan</option></select></label>{error && <div className="announcement-inline-error">{error}</div>}<footer><button type="button" className="btn btn-outline btn-sm" onClick={() => setEditing(undefined)}>Batal</button><button className="btn btn-primary btn-sm" disabled={busy}>{busy ? "Menyimpan..." : "Simpan"}</button></footer></form></Drawer>}
  </MasterShell>;
}
