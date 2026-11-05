"use client";
import { useMemo, useState } from "react";
import { Filter, MapPinned, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { MasterShell } from "@/features/master-data/shifts/components/shift-manager";
import { CoordinateMap, LocationModal } from "@/features/master-data/shared/location-modal";
import { confirmDelete } from "@/components/confirm-dialog";

type LocationType = "headquarters" | "branch" | "warehouse" | "other";
export type AttendanceLocationRow = { id: string; name: string; type: LocationType; address: string; latitude: number; longitude: number; radiusMeters: number; active: boolean };
const typeLabels: Record<LocationType, string> = { headquarters: "Pusat", branch: "Cabang", warehouse: "Gudang", other: "Lainnya" };
const DEFAULT_COORDINATE = { latitude: -7.7956, longitude: 110.3695 };

export function AttendanceLocationManager({ initialRows, canManage }: { initialRows: AttendanceLocationRow[]; canManage: boolean }) {
  const [rows, setRows] = useState(initialRows), [query, setQuery] = useState(""), [status, setStatus] = useState(""), [showFilter, setShowFilter] = useState(false), [editing, setEditing] = useState<AttendanceLocationRow | null | undefined>();
  const [coordinates, setCoordinates] = useState(DEFAULT_COORDINATE), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [address, setAddress] = useState("");
  const [pointSelected, setPointSelected] = useState(false);
  const filtered = useMemo(() => rows.filter((row) => row.name.toLowerCase().includes(query.toLowerCase()) && (!status || String(row.active) === status)), [rows, query, status]);
  function open(row: AttendanceLocationRow | null) { setError(""); setEditing(row); setPointSelected(Boolean(row)); setCoordinates(row ? { latitude: row.latitude, longitude: row.longitude } : rows[0] ? { latitude: rows[0].latitude, longitude: rows[0].longitude } : DEFAULT_COORDINATE); setAddress(row?.address ?? ""); }
  function bodyFrom(row: AttendanceLocationRow, active = row.active) { return { name: row.name, type: row.type, address: row.address, latitude: row.latitude, longitude: row.longitude, radiusMeters: row.radiusMeters, active }; }
  async function save(form: FormData) {
    if (!pointSelected) { setError("Pilih titik lokasi pada peta, hasil pencarian, atau isi koordinat manual sebelum menyimpan."); return; }
    setBusy(true); setError("");
    const body = { name: String(form.get("name")), type: String(form.get("type")), address: String(form.get("address")), radiusMeters: Number(form.get("radiusMeters")), ...coordinates, active: editing?.active ?? true };
    try {
      const response = await fetch(editing ? `/api/master/attendance-locations/${editing.id}` : "/api/master/attendance-locations", { method: editing ? "PATCH" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const payload = await response.json();
      if (!response.ok) return setError(payload.error ?? "Gagal menyimpan lokasi.");
      setRows((current) => editing ? current.map((row) => row.id === payload.row.id ? payload.row : row) : [...current, payload.row].sort((a, b) => a.name.localeCompare(b.name)));
      setEditing(undefined);
    } catch { setError("Server tidak dapat dihubungi."); } finally { setBusy(false); }
  }
  async function toggle(row: AttendanceLocationRow) { const response = await fetch(`/api/master/attendance-locations/${row.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(bodyFrom(row, !row.active)) }); const payload = await response.json(); if (response.ok) setRows((current) => current.map((item) => item.id === row.id ? payload.row : item)); else setError(payload.error); }
  async function remove(row: AttendanceLocationRow) { if (!await confirmDelete(`Hapus lokasi presensi “${row.name}”?`)) return; const response = await fetch(`/api/master/attendance-locations/${row.id}`, { method: "DELETE" }); const payload = await response.json(); if (response.ok) setRows((current) => current.filter((item) => item.id !== row.id)); else setError(payload.error); }
  return <MasterShell title="DAFTAR LOKASI PRESENSI" breadcrumb="Beranda / Lokasi Kerja / Daftar Lokasi Kerja">
    <section className="master-reference-card location-list-card">
      <div className="master-toolbar attendance-location-toolbar"><div className="master-search"><Search size={16}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari nama lokasi ..."/></div><button className={`location-filter-button ${showFilter ? "active" : ""}`} onClick={() => setShowFilter((value) => !value)}><Filter size={20}/><span>Filter</span></button><span/>{canManage && <button className="btn btn-primary master-add" onClick={() => open(null)}><Plus size={17}/> Tambah Lokasi</button>}</div>
      {showFilter && <div className="location-filter-panel"><label>Status Lokasi<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">Semua Status</option><option value="true">Aktif</option><option value="false">Nonaktif</option></select></label><button onClick={() => { setStatus(""); setQuery(""); }}>Reset Filter</button></div>}
      {error && editing === undefined && <div className="announcement-inline-error">{error}</div>}
      <table className="master-reference-table"><thead><tr><th>#</th><th>Nama</th><th>Radius</th><th>Tipe Lokasi</th><th>Status</th>{canManage && <th>Aksi</th>}</tr></thead><tbody>
        {filtered.map((row, index) => <tr key={row.id}><td>{index + 1}</td><td><strong>{row.name}</strong><small>{row.address}</small></td><td>{row.radiusMeters}m</td><td>{typeLabels[row.type]}</td><td><button className={`master-toggle ${row.active ? "active" : ""}`} onClick={() => canManage && toggle(row)} disabled={!canManage}><i/><span>{row.active ? "Aktif" : "Nonaktif"}</span></button></td>{canManage && <td><div className="master-actions icon-actions"><button aria-label="Edit" onClick={() => open(row)}><Pencil size={15}/></button><button aria-label="Hapus" className="danger" onClick={() => remove(row)}><Trash2 size={15}/></button></div></td>}</tr>)}
        {!filtered.length && <tr><td colSpan={6}><div className="location-empty"><MapPinned size={45}/><strong>Data Kosong</strong><span>Belum ada lokasi presensi.</span></div></td></tr>}
      </tbody></table>
      <div className="location-pagination"><span>menampilkan {filtered.length} dari {rows.length} data</span><div><button disabled>←</button><button className="active">1</button><button disabled>→</button></div></div>
    </section>
    {editing !== undefined && <LocationModal title={editing ? "Edit Lokasi" : "Tambah Lokasi"} onClose={() => setEditing(undefined)}><form action={save} className="location-form">
      <CoordinateMap {...coordinates} searchEnabled searchBiasEnabled={Boolean(editing)} onChange={(latitude, longitude) => { setCoordinates({ latitude, longitude }); setPointSelected(true); }} onAddressSelect={setAddress}/>
      <div className="location-form-grid three"><label>Nama Lokasi<input name="name" defaultValue={editing?.name ?? ""} placeholder="Masukkan nama lokasi" required/></label><label>Tipe Lokasi<select name="type" defaultValue={editing?.type ?? "headquarters"}><option value="headquarters">Pusat</option><option value="branch">Cabang</option><option value="warehouse">Gudang</option><option value="other">Lainnya</option></select></label><label>Radius<div className="input-addon"><input name="radiusMeters" type="number" min="10" max="10000" defaultValue={editing?.radiusMeters ?? 100} required/><span>Meter</span></div></label><label className="span-two">Alamat Lokasi<textarea name="address" value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Masukkan alamat lengkap" required/></label></div>
      {error && <div className="announcement-inline-error">{error}</div>}<footer><button type="button" className="btn btn-outline btn-sm" onClick={() => setEditing(undefined)}>Batalkan</button><button className="btn btn-primary btn-sm" disabled={busy}>{busy ? "Menyimpan..." : editing ? "Simpan Perubahan" : "Tambahkan Lokasi"}</button></footer>
    </form></LocationModal>}
  </MasterShell>;
}
