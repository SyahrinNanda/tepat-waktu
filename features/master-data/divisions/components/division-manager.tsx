"use client";
import { useMemo, useState } from "react";
import { Pencil, Plus, RotateCcw, Search, Trash2 } from "lucide-react";
import { Drawer, MasterShell, type ShiftRow } from "@/features/master-data/shifts/components/shift-manager";
import { confirmDelete } from "@/components/confirm-dialog";
import { MultiSelectDropdown } from "@/components/multi-select-dropdown";

type DivisionRow = { id: string; name: string; scheduleId: string | null; scheduleIds: string[]; shiftNames: string[]; active: boolean; employeeCount: number };

export function DivisionManager({ initialRows, shifts, canManage }: { initialRows: DivisionRow[]; shifts: ShiftRow[]; canManage: boolean }) {
  const [rows, setRows] = useState(initialRows);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("");
  const [editing, setEditing] = useState<DivisionRow | null | undefined>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const filtered = useMemo(() => rows.filter((row) => row.name.toLowerCase().includes(query.toLowerCase()) && (!filter || row.scheduleIds.includes(filter))), [rows, query, filter]);

  async function save(body: { name: string; scheduleIds: string[]; active: boolean }) {
    setBusy(true); setError("");
    const response = await fetch(editing ? `/api/master/divisions/${editing.id}` : "/api/master/divisions", { method: editing ? "PATCH" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const payload = await response.json();
    if (!response.ok) setError(payload.error);
    else {
      const row: DivisionRow = { ...payload.row, employeeCount: editing?.employeeCount ?? 0 };
      setRows((old) => editing ? old.map((item) => item.id === row.id ? row : item) : [...old, row].sort((a, b) => a.name.localeCompare(b.name)));
      setEditing(undefined);
    }
    setBusy(false);
  }

  async function remove(row: DivisionRow) {
    if (!await confirmDelete(`Hapus divisi “${row.name}”?`)) return;
    const response = await fetch(`/api/master/divisions/${row.id}`, { method: "DELETE" });
    const payload = await response.json();
    if (response.ok) setRows((old) => old.filter((item) => item.id !== row.id)); else setError(payload.error);
  }

  return <MasterShell title="DAFTAR DIVISI" breadcrumb="Beranda / Manajemen Divisi / Daftar Divisi">
    <section className="master-reference-card">
      <div className="master-toolbar division-toolbar">
        <div className="master-search"><Search size={16}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nama Divisi..."/></div>
        <select value={filter} onChange={(event) => setFilter(event.target.value)}><option value="">Pilih Jadwal Kerja</option>{shifts.map((shift) => <option key={shift.id} value={shift.id}>{shift.name}</option>)}</select>
        <button className="master-reset" onClick={() => { setQuery(""); setFilter(""); }}><RotateCcw size={17}/></button><span/>
        {canManage && <button className="btn btn-primary master-add" onClick={() => { setError(""); setEditing(null); }}><Plus size={17}/> Tambah Divisi</button>}
      </div>
      {error && editing === undefined && <div className="announcement-inline-error">{error}</div>}
      <table className="master-reference-table">
        <thead><tr><th>#</th><th>Nama Divisi</th><th>Jadwal Kerja Divisi</th><th>Karyawan</th><th>Status</th>{canManage && <th>Aksi</th>}</tr></thead>
        <tbody>
          {filtered.map((row, index) => <tr key={row.id}>
            <td>{index + 1}</td><td><strong>{row.name}</strong></td>
            <td>{row.shiftNames.length ? <div className="division-shift-tags">{row.shiftNames.map((name) => <span key={name}>{name}</span>)}</div> : "—"}</td>
            <td>{row.employeeCount}</td>
            <td><span className={`status-pill ${row.active ? "green" : "gray"}`}>{row.active ? "Aktif" : "Nonaktif"}</span></td>
            {canManage && <td><div className="master-actions"><button onClick={() => { setError(""); setEditing(row); }}><Pencil size={14}/> Edit</button><button className="danger" onClick={() => remove(row)}><Trash2 size={14}/> Hapus</button></div></td>}
          </tr>)}
          {!filtered.length && <tr><td colSpan={canManage ? 6 : 5}><div className="master-empty">Belum ada divisi.</div></td></tr>}
        </tbody>
      </table>
    </section>
    {editing !== undefined && <Drawer title={editing ? "Edit Divisi" : "Tambah Divisi"} onClose={() => setEditing(undefined)}>
      <DivisionForm key={editing?.id ?? "new"} editing={editing} shifts={shifts} busy={busy} error={error} onCancel={() => setEditing(undefined)} onSubmit={save} onError={setError}/>
    </Drawer>}
  </MasterShell>;
}

function DivisionForm({ editing, shifts, busy, error, onCancel, onSubmit, onError }: {
  editing: DivisionRow | null; shifts: ShiftRow[]; busy: boolean; error: string;
  onCancel: () => void; onSubmit: (body: { name: string; scheduleIds: string[]; active: boolean }) => void; onError: (message: string) => void;
}) {
  // Order matters: the first checked schedule is the division's primary one.
  const [selected, setSelected] = useState<string[]>(editing?.scheduleIds ?? []);
  const options = shifts.filter((shift) => shift.active || selected.includes(shift.id));
  const change = (values: string[]) => { onError(""); setSelected(values); };

  // A plain submit handler (not a form action) so React does not reset the typed name after an error.
  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected.length) { onError("Pilih minimal satu jadwal kerja."); return; }
    const form = new FormData(event.currentTarget);
    onSubmit({ name: String(form.get("name")), scheduleIds: selected, active: form.get("active") === "on" });
  }

  return <form onSubmit={submit} className="drawer-form">
    <label>Nama Divisi<input name="name" defaultValue={editing?.name ?? ""} placeholder="Nama Divisi..." required/></label>
    <div className="division-shift-picker">
      <label htmlFor="division-schedules">Jadwal Kerja Divisi</label>
      <MultiSelectDropdown id="division-schedules" options={options.map((shift) => ({ value: shift.id, label: shift.active ? shift.name : `${shift.name} (nonaktif)` }))}
        selected={selected} onChange={change} placeholder="Pilih Jadwal Kerja" searchPlaceholder="Cari jadwal kerja..."
        emptyText="Belum ada jadwal kerja. Tambahkan di Master Data → Jadwal Kerja."
        badge={(_value, index) => index === 0 ? <em className="multi-select-badge">Utama</em> : null}/>
      {selected.length > 1 && <p className="division-shift-hint">Saat mencatat kehadiran, karyawan memakai jadwal yang jam masuknya paling dekat dengan waktu check-in. Jadwal “Utama” (dipilih pertama) dipakai untuk lembur dan slip gaji.</p>}
    </div>
    <label className="drawer-switch"><span>Status aktif</span><input name="active" type="checkbox" defaultChecked={editing?.active ?? true}/></label>
    {error && <div className="announcement-inline-error">{error}</div>}
    <footer><button type="button" className="btn btn-outline btn-sm" onClick={onCancel}>Batal</button><button className="btn btn-primary btn-sm" disabled={busy}>{busy ? "Menyimpan..." : "Simpan"}</button></footer>
  </form>;
}
