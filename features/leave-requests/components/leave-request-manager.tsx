"use client";
import { useMemo, useState } from "react";
import { CalendarPlus, Download, FileText, Filter, Pencil, Plus, RotateCcw, Search, UserRound } from "lucide-react";
import { MasterShell } from "@/features/master-data/shifts/components/shift-manager";
import { LocationModal } from "@/features/master-data/shared/location-modal";
import { confirmAction } from "@/components/confirm-dialog";

type LeaveType = "annual" | "sick" | "permission";
type LeaveStatus = "pending" | "approved" | "rejected";
export type LeaveRow = { id: string; employeeId: string; name: string; employeeCode: string; department: string; type: LeaveType; startDate: string; endDate: string; reason: string; status: LeaveStatus; paid: boolean; createdAt: Date | string };
export type EmployeeOption = { id: string; name: string; employeeCode: string; department: string };
const typeLabels: Record<LeaveType, string> = { annual: "Cuti Tahunan", sick: "Sakit", permission: "Izin" };
const statusLabels: Record<LeaveStatus, string> = { pending: "Menunggu", approved: "Disetujui", rejected: "Ditolak" };

export function LeaveRequestManager({ initialRows, employees, canReview, today }: { initialRows: LeaveRow[]; employees: EmployeeOption[]; canReview: boolean; today: string }) {
  const [rows, setRows] = useState(initialRows), [query, setQuery] = useState(""), [month, setMonth] = useState(today.slice(5, 7)), [year, setYear] = useState(today.slice(0, 4)), [status, setStatus] = useState<LeaveStatus | "">("pending"), [editing, setEditing] = useState<LeaveRow | null | undefined>();
  const [showFilters, setShowFilters] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]), [employeeId, setEmployeeId] = useState(""), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const years = useMemo(() => [...new Set([String(new Date().getFullYear()), ...rows.map((row) => row.startDate.slice(0, 4))])].sort().reverse(), [rows]);
  const filtered = useMemo(() => rows.filter((row) => row.name.toLowerCase().includes(query.toLowerCase()) && (!month || row.startDate.slice(5, 7) === month) && (!year || row.startDate.slice(0, 4) === year) && (!status || row.status === status)), [rows, query, month, year, status]);
  function open(row: LeaveRow | null) { setError(""); setEditing(row); setEmployeeId(row?.employeeId ?? (employees.length === 1 ? employees[0].id : "")); }
  async function save(form: FormData) {
    setBusy(true); setError("");
    const paidChoice = String(form.get("paid") ?? "auto");
    const body = { employeeId, type: String(form.get("type")), startDate: String(form.get("startDate")), endDate: String(form.get("endDate")), reason: String(form.get("reason")), ...(paidChoice === "auto" ? {} : { paid: paidChoice === "paid" }) };
    try {
      const response = await fetch(editing ? `/api/leave-requests/${editing.id}` : "/api/leave-requests", { method: editing ? "PATCH" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const payload = await response.json();
      if (!response.ok) return setError(payload.error ?? "Gagal menyimpan pengajuan.");
      setRows((current) => editing ? current.map((row) => row.id === payload.row.id ? { ...row, ...payload.row } : row) : [payload.row, ...current]);
      setEditing(undefined);
    } catch { setError("Server tidak dapat dihubungi."); } finally { setBusy(false); }
  }
  async function review(ids: string[], nextStatus: "approved" | "rejected") {
    if (!ids.length || !await confirmAction(`${nextStatus === "approved" ? "Setujui" : "Tolak"} ${ids.length} pengajuan terpilih?`, "Konfirmasi Persetujuan")) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/leave-requests", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ ids, status: nextStatus }) });
      const payload = await response.json();
      if (!response.ok) return setError(payload.error ?? "Gagal memproses pengajuan.");
      const processed = new Set(payload.rows.map((row: { id: string }) => row.id));
      setRows((current) => current.map((row) => processed.has(row.id) ? { ...row, status: nextStatus } : row)); setSelectedIds([]);
    } catch { setError("Server tidak dapat dihubungi."); } finally { setBusy(false); }
  }
  async function togglePaid(row: LeaveRow) {
    const paid = !row.paid;
    if (!await confirmAction(`Ubah izin ${row.name} menjadi ${paid ? "DIBAYAR" : "TIDAK DIBAYAR"}? Slip gaji bulan terkait yang belum dikunci akan ikut berubah.`, "Status Gaji Izin")) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/leave-requests/${row.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "pay", paid }) });
      const payload = await response.json();
      if (!response.ok) return setError(payload.error ?? "Gagal mengubah status gaji.");
      setRows((current) => current.map((item) => item.id === row.id ? { ...item, paid } : item));
    } catch { setError("Server tidak dapat dihubungi."); } finally { setBusy(false); }
  }
  function toggleSelection(id: string) { setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]); }
  function resetFilters() { setQuery(""); setMonth(""); setYear(""); setStatus(""); }
  function exportCsv() { const header = ["Karyawan", "NIK", "Jenis", "Mulai", "Selesai", "Alasan", "Status"]; const quote = (value: unknown) => `"${String(value).replaceAll('"', '""')}"`; const csv = `\uFEFF${header.map(quote).join(",")}\r\n${filtered.map((row) => [row.name, row.employeeCode, typeLabels[row.type], row.startDate, row.endDate, row.reason, statusLabels[row.status]].map(quote).join(",")).join("\r\n")}`; const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })); const link = document.createElement("a"); link.href = url; link.download = "pengajuan-izin-cuti.csv"; link.click(); URL.revokeObjectURL(url); }
  const pendingVisible = filtered.filter((row) => row.status === "pending");
  return <MasterShell title="DAFTAR PENGAJUAN IZIN/CUTI" breadcrumb="Beranda / Pengajuan / Daftar Pengajuan Izin/Cuti">
    <section className="leave-reference-card">
      <div className="leave-primary-toolbar"><div className="master-search"><Search size={16}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari nama karyawan..."/></div><button className={`leave-filter-button ${showFilters ? "active" : ""}`} onClick={() => setShowFilters((value) => !value)}><Filter size={19}/> Filter</button><button className="btn btn-primary" onClick={exportCsv}><Download size={16}/> Ekspor Excel</button><span/>{canReview && <><button className="btn btn-outline" disabled={!selectedIds.length || busy} onClick={() => review(selectedIds, "rejected")}>Tolak</button><button className="btn btn-primary" disabled={!selectedIds.length || busy} onClick={() => review(selectedIds, "approved")}>Setujui</button></>}<button className="btn btn-primary" onClick={() => open(null)}><Plus size={16}/> Tambah</button></div>
      {showFilters && <div className="leave-filter-row"><label>Bulan<select value={month} onChange={(event) => setMonth(event.target.value)}><option value="">Semua Bulan</option>{["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"].map((name, index) => <option key={name} value={String(index + 1).padStart(2, "0")}>{name}</option>)}</select></label><label>Tahun<select value={year} onChange={(event) => setYear(event.target.value)}><option value="">Semua Tahun</option>{years.map((item) => <option key={item}>{item}</option>)}</select></label><div className="leave-status-tabs">{(["pending", "approved", "rejected"] as LeaveStatus[]).map((item) => <button key={item} className={status === item ? "active" : ""} onClick={() => setStatus(status === item ? "" : item)}>{statusLabels[item]}</button>)}</div><button className="leave-reset" onClick={resetFilters}><RotateCcw size={17}/> Reset Filter</button></div>}
      {error && editing === undefined && <div className="announcement-inline-error">{error}</div>}
      {filtered.length ? <div className="table-scroll"><table className="master-reference-table leave-table"><thead><tr>{canReview && <th><input type="checkbox" aria-label="Pilih semua" checked={pendingVisible.length > 0 && pendingVisible.every((row) => selectedIds.includes(row.id))} onChange={(event) => setSelectedIds(event.target.checked ? pendingVisible.map((row) => row.id) : [])}/></th>}<th>Karyawan</th><th>Jenis</th><th>Periode</th><th>Durasi</th><th>Alasan</th><th>Gaji</th><th>Status</th><th>Aksi</th></tr></thead><tbody>{filtered.map((row) => <tr key={row.id}>{canReview && <td><input type="checkbox" disabled={row.status !== "pending"} checked={selectedIds.includes(row.id)} onChange={() => toggleSelection(row.id)}/></td>}<td><div className="leave-employee"><span><UserRound size={15}/></span><div><strong>{row.name}</strong><small>{row.employeeCode} · {row.department}</small></div></div></td><td>{typeLabels[row.type]}</td><td>{formatDate(row.startDate)} – {formatDate(row.endDate)}</td><td>{duration(row.startDate, row.endDate)} hari</td><td className="leave-reason">{row.reason}</td><td>{canReview ? <button type="button" className={`leave-paid ${row.paid ? "paid" : "unpaid"}`} disabled={busy} onClick={() => togglePaid(row)} title="Klik untuk mengubah status gaji">{row.paid ? "Dibayar" : "Tidak dibayar"}</button> : <span className={`leave-paid ${row.paid ? "paid" : "unpaid"}`}>{row.paid ? "Dibayar" : "Tidak dibayar"}</span>}</td><td><span className={`leave-status ${row.status}`}>{statusLabels[row.status]}</span></td><td><div className="master-actions"><button disabled={row.status !== "pending"} onClick={() => open(row)}><Pencil size={14}/> Edit</button></div></td></tr>)}</tbody></table></div> : <div className="location-empty leave-empty"><FileText size={48}/><strong>Data Kosong</strong><span>Tidak ada pengajuan yang sesuai filter.</span></div>}
    </section>
    {editing !== undefined && <LocationModal title={editing ? "Edit Pengajuan Izin/Cuti" : "Tambah Pengajuan Izin/Cuti"} onClose={() => setEditing(undefined)}><form action={save} className="leave-modal-form"><div className="leave-modal-grid"><label className="full">Karyawan<EmployeeCombobox employees={employees} value={employeeId} onChange={setEmployeeId}/></label><label>Jenis Pengajuan<select name="type" defaultValue={editing?.type ?? "annual"}><option value="annual">Cuti Tahunan</option><option value="sick">Sakit</option><option value="permission">Izin</option></select></label>{canReview ? <label>Status Gaji<select name="paid" defaultValue={editing ? (editing.paid ? "paid" : "unpaid") : "auto"}><option value="auto">Ikuti jenis (Cuti & Sakit dibayar, Izin tidak)</option><option value="paid">Dibayar</option><option value="unpaid">Tidak dibayar</option></select></label> : <span/>}<label>Tanggal Mulai<input name="startDate" type="date" defaultValue={editing?.startDate ?? today} required/></label><label>Tanggal Selesai<input name="endDate" type="date" defaultValue={editing?.endDate ?? today} required/></label><label className="full">Alasan<textarea name="reason" defaultValue={editing?.reason ?? ""} maxLength={500} placeholder="Jelaskan alasan izin atau cuti" required/></label></div>{error && <div className="announcement-inline-error">{error}</div>}<footer><button type="button" className="btn btn-outline btn-sm" onClick={() => setEditing(undefined)}>Batal</button><button className="btn btn-primary btn-sm" disabled={busy || !employeeId}><CalendarPlus size={15}/>{busy ? "Menyimpan..." : "Simpan"}</button></footer></form></LocationModal>}
  </MasterShell>;
}

export function EmployeeCombobox({ employees, value, onChange }: { employees: EmployeeOption[]; value: string; onChange: (id: string) => void }) {
  const selected = employees.find((employee) => employee.id === value), [open, setOpen] = useState(false), [search, setSearch] = useState("");
  const options = employees.filter((employee) => `${employee.name} ${employee.employeeCode} ${employee.department}`.toLowerCase().includes(search.toLowerCase()));
  return <div className="employee-combobox"><button type="button" onClick={() => setOpen((current) => !current)}><span>{selected ? selected.name : "Cari dan pilih karyawan..."}</span><small>{selected ? `${selected.employeeCode} · ${selected.department}` : "⌄"}</small></button>{open && <div className="employee-combobox-popover"><div><Search size={14}/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari nama atau NIK..." autoFocus/></div><ul>{options.map((employee) => <li key={employee.id}><button type="button" onClick={() => { onChange(employee.id); setOpen(false); setSearch(""); }}><strong>{employee.name}</strong><small>{employee.employeeCode} · {employee.department}</small></button></li>)}{!options.length && <li className="no-result">Karyawan tidak ditemukan.</li>}</ul></div>}</div>;
}
function duration(start: string, end: string) { return Math.floor((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000) + 1; }
function formatDate(value: string) { return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`)); }
