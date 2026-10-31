"use client";
import { useMemo, useState } from "react";
import { MapPinned, Pencil, Plus, RotateCcw, Search, Trash2, Users } from "lucide-react";
import { MasterShell } from "@/features/master-data/shifts/components/shift-manager";
import { CoordinateMap, LocationModal } from "@/features/master-data/shared/location-modal";
import { confirmDelete } from "@/components/confirm-dialog";

export type VisitLocationRow = { id: string; name: string; ownerName: string; email: string | null; phone: string; address: string; latitude: number; longitude: number; radiusMeters: number; active: boolean; employeeIds: string[]; employeeCount: number };
type EmployeeOption = { id: string; name: string; employeeCode: string };
const DEFAULT_COORDINATE = { latitude: -7.7956, longitude: 110.3695 };

export function VisitLocationManager({ initialRows, employees, canManage }: { initialRows: VisitLocationRow[]; employees: EmployeeOption[]; canManage: boolean }) {
  const [rows, setRows] = useState(initialRows), [query, setQuery] = useState(""), [editing, setEditing] = useState<VisitLocationRow | null | undefined>();
  const [coordinates, setCoordinates] = useState(DEFAULT_COORDINATE), [selectedEmployees, setSelectedEmployees] = useState<string[]>([]), [allEmployees, setAllEmployees] = useState(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [pointSelected, setPointSelected] = useState(false);
  const filtered = useMemo(() => rows.filter((row) => [row.name, row.ownerName, row.email ?? "", row.phone].some((value) => value.toLowerCase().includes(query.toLowerCase()))), [rows, query]);
  function open(row: VisitLocationRow | null) { setError(""); setEditing(row); setPointSelected(Boolean(row)); setCoordinates(row ? { latitude: row.latitude, longitude: row.longitude } : rows[0] ? { latitude: rows[0].latitude, longitude: rows[0].longitude } : DEFAULT_COORDINATE); setSelectedEmployees(row?.employeeIds ?? []); setAllEmployees(row ? row.employeeIds.length === employees.length && employees.length > 0 : false); }
  function selectEmployee(id: string) { setAllEmployees(false); setSelectedEmployees((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]); }
  async function save(form: FormData) {
    if (!pointSelected) { setError("Pilih titik lokasi pada peta atau isi koordinat manual sebelum menyimpan."); return; }
    setBusy(true); setError("");
    const body = { name: String(form.get("name")), ownerName: String(form.get("ownerName")), email: String(form.get("email")), phone: String(form.get("phone")), address: String(form.get("address")), radiusMeters: Number(form.get("radiusMeters")), ...coordinates, active: editing?.active ?? true, allEmployees, employeeIds: selectedEmployees };
    try {
      const response = await fetch(editing ? `/api/master/visit-locations/${editing.id}` : "/api/master/visit-locations", { method: editing ? "PATCH" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const payload = await response.json();
      if (!response.ok) return setError(payload.error ?? "Gagal menyimpan lokasi.");
      setRows((current) => editing ? current.map((row) => row.id === payload.row.id ? payload.row : row) : [...current, payload.row].sort((a, b) => a.name.localeCompare(b.name)));
      setEditing(undefined);
    } catch { setError("Server tidak dapat dihubungi."); } finally { setBusy(false); }
  }
  async function remove(row: VisitLocationRow) { if (!await confirmDelete(`Hapus lokasi kunjungan “${row.name}”?`)) return; const response = await fetch(`/api/master/visit-locations/${row.id}`, { method: "DELETE" }); const payload = await response.json(); if (response.ok) setRows((current) => current.filter((item) => item.id !== row.id)); else setError(payload.error); }
  return <MasterShell title="DAFTAR LOKASI KUNJUNGAN" breadcrumb="Beranda / Lokasi Kunjungan / Daftar Lokasi Kunjungan">
    <section className="master-reference-card location-list-card">
      <div className="master-toolbar"><div className="master-search"><Search size={16}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari nama kunjungan ..."/></div><button className="master-reset" onClick={() => setQuery("")}><RotateCcw size={17}/></button><span/>{canManage && <button className="btn btn-primary master-add" onClick={() => open(null)}><Plus size={17}/> Tambah Lokasi</button>}</div>
      {error && editing === undefined && <div className="announcement-inline-error">{error}</div>}
      <div className="table-scroll"><table className="master-reference-table"><thead><tr><th>#</th><th>Lokasi Kunjungan</th><th>Nama Pemilik</th><th>Email</th><th>No. Telepon</th><th>Karyawan</th>{canManage && <th>Aksi</th>}</tr></thead><tbody>
        {filtered.map((row, index) => <tr key={row.id}><td>{index + 1}</td><td><strong>{row.name}</strong><small>{row.address}</small></td><td>{row.ownerName}</td><td>{row.email || "—"}</td><td>{row.phone}</td><td><span className="employee-count"><Users size={14}/>{row.employeeCount}</span></td>{canManage && <td><div className="master-actions icon-actions"><button aria-label="Edit" onClick={() => open(row)}><Pencil size={15}/></button><button aria-label="Hapus" className="danger" onClick={() => remove(row)}><Trash2 size={15}/></button></div></td>}</tr>)}
        {!filtered.length && <tr><td colSpan={7}><div className="location-empty"><MapPinned size={45}/><strong>Data Kosong</strong><span>Belum ada lokasi kunjungan.</span></div></td></tr>}
      </tbody></table></div>
      <div className="location-pagination"><span>menampilkan {filtered.length} dari {rows.length} data</span><div><button disabled>←</button><button className="active">1</button><button disabled>→</button></div></div>
    </section>
    {editing !== undefined && <LocationModal title={editing ? "Edit Lokasi Kunjungan" : "Tambah Lokasi Kunjungan"} onClose={() => setEditing(undefined)}><form action={save} className="location-form">
      <CoordinateMap {...coordinates} onChange={(latitude, longitude) => { setCoordinates({ latitude, longitude }); setPointSelected(true); }}/>
      <div className="location-form-grid three"><label>Nama Lokasi Kunjungan<input name="name" defaultValue={editing?.name ?? ""} placeholder="Ketik lokasi kunjungan disini" required/></label><label>Nama Pemilik<input name="ownerName" defaultValue={editing?.ownerName ?? ""} placeholder="Ketik nama pemilik disini" required/></label><label>Email Lokasi Kunjungan<input name="email" type="email" defaultValue={editing?.email ?? ""} placeholder="Email Lokasi Kunjungan..."/></label><label>No. Telepon Lokasi Kunjungan<input name="phone" defaultValue={editing?.phone ?? ""} placeholder="Ketik nomor telepon disini" required/></label><label className="span-two">Alamat<textarea name="address" defaultValue={editing?.address ?? ""} placeholder="Ketik alamat disini" required/></label><label>Radius Kunjungan<div className="input-addon"><input name="radiusMeters" type="number" min="10" max="10000" defaultValue={editing?.radiusMeters ?? 100} required/><span>Meter</span></div></label><div className="span-two employee-picker"><span>Karyawan</span><div className="employee-picker-list"><label><input type="checkbox" checked={allEmployees} onChange={(event) => { setAllEmployees(event.target.checked); setSelectedEmployees(event.target.checked ? employees.map((employee) => employee.id) : []); }}/> Semua Karyawan</label>{employees.map((employee) => <label key={employee.id}><input type="checkbox" checked={selectedEmployees.includes(employee.id)} onChange={() => selectEmployee(employee.id)}/><span>{employee.name}</span><small>{employee.employeeCode}</small></label>)}</div></div></div>
      {error && <div className="announcement-inline-error">{error}</div>}<footer><button type="button" className="btn btn-outline btn-sm" onClick={() => setEditing(undefined)}>Batalkan</button><button className="btn btn-primary btn-sm" disabled={busy}>{busy ? "Menyimpan..." : editing ? "Simpan Perubahan" : "Tambahkan Lokasi"}</button></footer>
    </form></LocationModal>}
  </MasterShell>;
}
