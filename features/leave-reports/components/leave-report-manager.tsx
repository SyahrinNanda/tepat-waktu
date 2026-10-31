"use client";

import Image from "next/image";
import { useMemo, useState, useTransition } from "react";
import { CircleUserRound, Ellipsis, Filter, Save, Search, X } from "lucide-react";
import { saveLeaveEntitlement } from "@/features/leave-reports/server/actions";

export type LeaveReportRow = { id: string; employeeCode: string; name: string; email: string; department: string; position: string; status: "active" | "inactive"; photoAssetId: string | null; maximumDays: number; usedDays: number };

export function LeaveReportManager({ initialRows, year, canManage }: { initialRows: LeaveReportRow[]; year: number; canManage: boolean }) {
  const [rows, setRows] = useState(initialRows), [query, setQuery] = useState(""), [menuId, setMenuId] = useState<string | null>(null), [editing, setEditing] = useState<LeaveReportRow | null>(null);
  const filtered = useMemo(() => rows.filter((row) => `${row.name} ${row.email} ${row.employeeCode}`.toLowerCase().includes(query.toLowerCase())), [rows, query]);
  return <>
    <div className="master-page-head leave-report-head"><span>TepatWaktu Admin Panel</span><h1>Laporan Cuti</h1></div>
    <section className="leave-report-card"><div className="leave-report-toolbar"><div className="master-search"><Search size={15}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nama Karyawan..."/></div><button type="button"><Filter size={17}/> Filter</button><form method="get"><select name="year" defaultValue={year} onChange={(event) => event.currentTarget.form?.requestSubmit()}>{Array.from({ length: 7 }, (_, index) => year - 3 + index).map((value) => <option key={value}>{value}</option>)}</select></form></div>
      <div className="table-scroll"><table className="leave-report-table"><thead><tr><th>#</th><th>Foto</th><th>Nama Karyawan</th><th>Jabatan–Divisi</th><th>Maksimal Cuti</th><th>Cuti Terpakai</th><th/></tr></thead><tbody>{filtered.map((row, index) => <tr key={row.id}><td>{index + 1}</td><td>{row.photoAssetId ? <Image className="leave-avatar" src={`/api/files/${row.photoAssetId}`} width={48} height={48} unoptimized alt={`Foto ${row.name}`}/> : <CircleUserRound className="leave-avatar-placeholder"/>}</td><td>{row.status === "inactive" && <span className="leave-inactive">Karyawan Belum Aktif</span>}<small className="leave-code">NI: {row.employeeCode}</small><strong>{row.name}</strong><small>{row.email}</small></td><td><strong>{row.position}</strong><small>{row.department}</small></td><td>{row.maximumDays}</td><td>{row.usedDays}</td><td className="leave-menu-cell">{canManage && <><button onClick={() => setMenuId(menuId === row.id ? null : row.id)}><Ellipsis size={19}/></button>{menuId === row.id && <div><button onClick={() => { setEditing(row); setMenuId(null); }}>Edit</button></div>}</>}</td></tr>)}</tbody></table>{!filtered.length && <div className="salary-empty">Data karyawan tidak ditemukan.</div>}</div><footer>menampilkan {filtered.length} dari {rows.length} data.</footer></section>
    {editing && <LeaveEditModal row={editing} year={year} onClose={() => setEditing(null)} onSaved={(maximumDays) => { setRows((current) => current.map((row) => row.id === editing.id ? { ...row, maximumDays } : row)); setEditing(null); }}/>} 
  </>;
}

function LeaveEditModal({ row, year, onClose, onSaved }: { row: LeaveReportRow; year: number; onClose: () => void; onSaved: (value: number) => void }) {
  const [maximumDays, setMaximumDays] = useState(row.maximumDays), [error, setError] = useState(""), [pending, start] = useTransition();
  function submit() { start(async () => { try { await saveLeaveEntitlement({ employeeId: row.id, year, maximumDays }); onSaved(maximumDays); } catch (cause) { setError(cause instanceof Error ? cause.message : "Kuota cuti gagal disimpan."); } }); }
  return <div className="reference-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="reference-modal leave-edit-modal" role="dialog" aria-modal="true"><header><h2>Edit Cuti Karyawan</h2><button onClick={onClose}><X size={17}/></button></header><div className="leave-edit-grid"><label>Nama Karyawan<strong>{row.name}</strong></label><label>Maksimal Cuti<input type="number" min="0" max="365" value={maximumDays} onChange={(event) => setMaximumDays(Number(event.target.value))}/></label><label>Cuti Terpakai<input value={row.usedDays} disabled/></label></div>{error && <div className="salary-error">{error}</div>}<footer><button className="btn btn-outline" onClick={onClose}>Batal</button><button className="btn btn-primary" disabled={pending} onClick={submit}><Save size={15}/>{pending ? "Menyimpan..." : "Simpan"}</button></footer></section></div>;
}
