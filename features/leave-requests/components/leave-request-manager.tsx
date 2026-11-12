"use client";
import { useEffect, useMemo, useState } from "react";
import { CalendarPlus, Download, FileText, Filter, Pencil, Plus, RotateCcw, Search, Settings2, UserRound } from "lucide-react";
import { MasterShell } from "@/features/master-data/shifts/components/shift-manager";
import { LocationModal } from "@/features/master-data/shared/location-modal";
import { confirmAction } from "@/components/confirm-dialog";
import { leaveDays, leaveLabel, leaveTypeLabels, type LeaveType } from "@/features/leave-requests/server/schemas";
import { describeKind, SpecialLeaveTypesModal, type SpecialLeaveKind } from "./special-leave-types-modal";
import type { AnnualLeaveBalance } from "@/features/leave-requests/annual-leave";

type LeaveStatus = "pending" | "approved" | "rejected";
export type LeaveRow = { id: string; employeeId: string; name: string; employeeCode: string; department: string; type: LeaveType; specialLeaveTypeId?: string | null; specialLeaveName?: string | null; workDays?: number | null; startDate: string; endDate: string; reason: string; status: LeaveStatus; paid: boolean; createdAt: Date | string };
export type EmployeeOption = { id: string; name: string; employeeCode: string; department: string };
type Preview = { ok: true; startDate: string; endDate: string; workDays: number; paid?: boolean } | { ok: false; error: string };
type AnnualPreview = { ok: boolean; error?: string; workDays?: number; balance?: AnnualLeaveBalance };
const statusLabels: Record<LeaveStatus, string> = { pending: "Menunggu", approved: "Disetujui", rejected: "Ditolak" };

export function LeaveRequestManager({ initialRows, employees, canReview, specialTypes, today, ownBalance }: { initialRows: LeaveRow[]; employees: EmployeeOption[]; canReview: boolean; specialTypes: SpecialLeaveKind[]; today: string; ownBalance?: AnnualLeaveBalance | null }) {
  const [annualPreview, setAnnualPreview] = useState<AnnualPreview | null>(null);
  const [kinds, setKinds] = useState(specialTypes), [managingKinds, setManagingKinds] = useState(false), [formType, setFormType] = useState<LeaveType>("annual"), [specialId, setSpecialId] = useState("");
  const [startDate, setStartDate] = useState(today), [endDate, setEndDate] = useState(today), [preview, setPreview] = useState<Preview | null>(null), [kindFilter, setKindFilter] = useState("");
  const [rows, setRows] = useState(initialRows), [query, setQuery] = useState(""), [month, setMonth] = useState(today.slice(5, 7)), [year, setYear] = useState(today.slice(0, 4)), [status, setStatus] = useState<LeaveStatus | "">("pending"), [editing, setEditing] = useState<LeaveRow | null | undefined>();
  const [showFilters, setShowFilters] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]), [employeeId, setEmployeeId] = useState(""), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const years = useMemo(() => [...new Set([String(new Date().getFullYear()), ...rows.map((row) => row.startDate.slice(0, 4))])].sort().reverse(), [rows]);
  const filtered = useMemo(() => rows.filter((row) => row.name.toLowerCase().includes(query.toLowerCase()) && (!month || row.startDate.slice(5, 7) === month) && (!year || row.startDate.slice(0, 4) === year) && (!status || row.status === status) && matchesKind(row, kindFilter)), [rows, query, month, year, status, kindFilter]);
  const kindNames = useMemo(() => [...new Set([...kinds.map((kind) => kind.name), ...rows.filter((row) => row.type === "special" && row.specialLeaveName).map((row) => row.specialLeaveName!)])].sort((a, b) => a.localeCompare(b, "id")), [kinds, rows]);
  const selectedKind = formType === "special" ? kinds.find((kind) => kind.id === specialId) : undefined;
  const fixedDuration = Boolean(selectedKind?.durationDays);
  // Cuti Khusus: ask the server for the dates in working days while the form is filled.
  useEffect(() => {
    if (editing === undefined || formType !== "special" || !specialId || !employeeId || !startDate) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch("/api/leave-requests/special-types/preview", { method: "POST", signal: controller.signal, headers: { "content-type": "application/json" }, body: JSON.stringify({ employeeId, specialLeaveTypeId: specialId, startDate, ...(fixedDuration ? {} : { endDate: endDate < startDate ? startDate : endDate }) }) })
        .then((response) => response.json()).then((result: Preview) => { setPreview(result); if (result.ok && fixedDuration) setEndDate(result.endDate); }).catch(() => undefined);
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [editing, formType, specialId, employeeId, startDate, endDate, fixedDuration]);
  const shownPreview = formType === "special" && specialId && employeeId ? preview : null;
  // Cuti Tahunan: remaining quota of the employee's leave period and the working days of this request.
  useEffect(() => {
    if (editing === undefined || formType !== "annual" || !employeeId || !startDate) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch("/api/leave-requests/annual-balance", { method: "POST", signal: controller.signal, headers: { "content-type": "application/json" }, body: JSON.stringify({ employeeId, startDate, endDate: endDate < startDate ? startDate : endDate, ...(editing ? { excludeId: editing.id } : {}) }) })
        .then((response) => response.json()).then((result: AnnualPreview) => setAnnualPreview(result)).catch(() => undefined);
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [editing, formType, employeeId, startDate, endDate]);
  const shownAnnual = formType === "annual" && employeeId ? annualPreview : null;
  function open(row: LeaveRow | null) { setError(""); setEditing(row); setEmployeeId(row?.employeeId ?? (employees.length === 1 ? employees[0].id : "")); setFormType(row?.type ?? "annual"); setSpecialId(row?.specialLeaveTypeId ?? ""); setStartDate(row?.startDate ?? today); setEndDate(row?.endDate ?? today); setPreview(null); setAnnualPreview(null); }
  async function save(form: FormData) {
    setBusy(true); setError("");
    const paidChoice = String(form.get("paid") ?? "auto");
    const body = { employeeId, type: formType, specialLeaveTypeId: formType === "special" ? specialId || null : null, startDate, endDate: fixedDuration ? startDate : endDate, reason: String(form.get("reason")), ...(paidChoice === "auto" ? {} : { paid: paidChoice === "paid" }) };
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
  function resetFilters() { setQuery(""); setMonth(""); setYear(""); setStatus(""); setKindFilter(""); }
  function exportCsv() { const header = ["Karyawan", "NIK", "Jenis", "Mulai", "Selesai", "Durasi", "Alasan", "Status"]; const quote = (value: unknown) => `"${String(value).replaceAll('"', '""')}"`; const csv = `\uFEFF${header.map(quote).join(",")}\r\n${filtered.map((row) => [row.name, row.employeeCode, leaveLabel(row.type, row.specialLeaveName), row.startDate, row.endDate, durationLabel(row), row.reason, statusLabels[row.status]].map(quote).join(",")).join("\r\n")}`; const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })); const link = document.createElement("a"); link.href = url; link.download = "pengajuan-izin-cuti.csv"; link.click(); URL.revokeObjectURL(url); }
  const pendingVisible = filtered.filter((row) => row.status === "pending");
  return <MasterShell title="DAFTAR PENGAJUAN IZIN/CUTI" breadcrumb="Beranda / Pengajuan / Daftar Pengajuan Izin/Cuti">
    {ownBalance && <AnnualBalanceCard balance={ownBalance}/>}
    <section className="leave-reference-card">
      <div className={`leave-primary-toolbar ${canReview ? "with-kinds" : ""}`}><div className="master-search"><Search size={16}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari nama karyawan..."/></div><button className={`leave-filter-button ${showFilters ? "active" : ""}`} onClick={() => setShowFilters((value) => !value)}><Filter size={19}/> Filter</button><button className="btn btn-primary" onClick={exportCsv}><Download size={16}/> Ekspor Excel</button><span/>{canReview && <button className="btn btn-outline" onClick={() => setManagingKinds(true)}><Settings2 size={16}/> Jenis Cuti Khusus</button>}{canReview && <><button className="btn btn-outline" disabled={!selectedIds.length || busy} onClick={() => review(selectedIds, "rejected")}>Tolak</button><button className="btn btn-primary" disabled={!selectedIds.length || busy} onClick={() => review(selectedIds, "approved")}>Setujui</button></>}<button className="btn btn-primary" onClick={() => open(null)}><Plus size={16}/> Tambah</button></div>
      {showFilters && <div className="leave-filter-row"><label>Bulan<select value={month} onChange={(event) => setMonth(event.target.value)}><option value="">Semua Bulan</option>{["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"].map((name, index) => <option key={name} value={String(index + 1).padStart(2, "0")}>{name}</option>)}</select></label><label>Tahun<select value={year} onChange={(event) => setYear(event.target.value)}><option value="">Semua Tahun</option>{years.map((item) => <option key={item}>{item}</option>)}</select></label><label>Jenis<select value={kindFilter} onChange={(event) => setKindFilter(event.target.value)}><option value="">Semua Jenis</option><option value="annual">Cuti Tahunan</option><option value="sick">Sakit</option><option value="permission">Izin</option><option value="special">Cuti Khusus (semua)</option>{kindNames.map((name) => <option key={name} value={`special:${name}`}>Cuti Khusus · {name}</option>)}</select></label><div className="leave-status-tabs">{(["pending", "approved", "rejected"] as LeaveStatus[]).map((item) => <button key={item} className={status === item ? "active" : ""} onClick={() => setStatus(status === item ? "" : item)}>{statusLabels[item]}</button>)}</div><button className="leave-reset" onClick={resetFilters}><RotateCcw size={17}/> Reset Filter</button></div>}
      {error && editing === undefined && <div className="announcement-inline-error">{error}</div>}
      {filtered.length ? <div className="table-scroll"><table className="master-reference-table leave-table"><thead><tr>{canReview && <th><input type="checkbox" aria-label="Pilih semua" checked={pendingVisible.length > 0 && pendingVisible.every((row) => selectedIds.includes(row.id))} onChange={(event) => setSelectedIds(event.target.checked ? pendingVisible.map((row) => row.id) : [])}/></th>}<th>Karyawan</th><th>Jenis</th><th>Periode</th><th>Durasi</th><th>Alasan</th><th>Gaji</th><th>Status</th><th>Aksi</th></tr></thead><tbody>{filtered.map((row) => <tr key={row.id}>{canReview && <td><input type="checkbox" disabled={row.status !== "pending"} checked={selectedIds.includes(row.id)} onChange={() => toggleSelection(row.id)}/></td>}<td><div className="leave-employee"><span><UserRound size={15}/></span><div><strong>{row.name}</strong><small>{row.employeeCode} · {row.department}</small></div></div></td><td>{row.type === "special" ? <div className="leave-kind"><span>{leaveTypeLabels.special}</span><small>{row.specialLeaveName ?? "-"}</small></div> : leaveTypeLabels[row.type]}</td><td>{formatDate(row.startDate)} – {formatDate(row.endDate)}</td><td>{durationLabel(row)}</td><td className="leave-reason">{row.reason}</td><td>{canReview ? <button type="button" className={`leave-paid ${row.paid ? "paid" : "unpaid"}`} disabled={busy} onClick={() => togglePaid(row)} title="Klik untuk mengubah status gaji">{row.paid ? "Dibayar" : "Tidak dibayar"}</button> : <span className={`leave-paid ${row.paid ? "paid" : "unpaid"}`}>{row.paid ? "Dibayar" : "Tidak dibayar"}</span>}</td><td><span className={`leave-status ${row.status}`}>{statusLabels[row.status]}</span></td><td><div className="master-actions"><button disabled={row.status !== "pending"} onClick={() => open(row)}><Pencil size={14}/> Edit</button></div></td></tr>)}</tbody></table></div> : <div className="location-empty leave-empty"><FileText size={48}/><strong>Data Kosong</strong><span>Tidak ada pengajuan yang sesuai filter.</span></div>}
    </section>
    {editing !== undefined && <LocationModal title={editing ? "Edit Pengajuan Izin/Cuti" : "Tambah Pengajuan Izin/Cuti"} onClose={() => setEditing(undefined)}><form onSubmit={(event) => { event.preventDefault(); void save(new FormData(event.currentTarget)); }} className="leave-modal-form"><div className="leave-modal-grid"><label className="full">Karyawan<EmployeeCombobox employees={employees} value={employeeId} onChange={setEmployeeId}/></label><label>Jenis Pengajuan<select name="type" value={formType} onChange={(event) => setFormType(event.target.value as LeaveType)}><option value="annual">Cuti Tahunan</option><option value="sick">Sakit</option><option value="permission">Izin</option><option value="special">Cuti Khusus</option></select></label>{canReview ? <label>Status Gaji<select name="paid" defaultValue={editing ? (editing.paid ? "paid" : "unpaid") : "auto"}><option value="auto">{formType === "special" ? "Ikuti pengaturan jenis cuti khusus" : "Ikuti jenis (Cuti & Sakit dibayar, Izin tidak)"}</option><option value="paid">Dibayar</option><option value="unpaid">Tidak dibayar</option></select></label> : <span/>}{formType === "special" && <SpecialKindField kinds={kinds} value={specialId} onChange={(id) => { setSpecialId(id); setPreview(null); }} canManage={canReview} onManage={() => setManagingKinds(true)} legacyName={editing?.type === "special" && !editing.specialLeaveTypeId ? editing.specialLeaveName : null}/>}<label>Tanggal Mulai<input name="startDate" type="date" value={startDate} onChange={(event) => { setStartDate(event.target.value); if (!fixedDuration && endDate < event.target.value) setEndDate(event.target.value); }} required/></label><label>{fixedDuration ? "Tanggal Selesai (otomatis)" : "Tanggal Selesai"}<input name="endDate" type="date" value={endDate} min={startDate} readOnly={fixedDuration} className={fixedDuration ? "readonly" : ""} onChange={(event) => setEndDate(event.target.value)} required/></label>{shownPreview && <div className={`full special-preview ${shownPreview.ok ? "ok" : "bad"}`} role="status">{shownPreview.ok ? <><strong>{shownPreview.workDays} hari kerja · {formatDate(shownPreview.startDate)} – {formatDate(shownPreview.endDate)}</strong><small>{shownPreview.startDate !== startDate ? `Tanggal mulai digeser ke hari kerja pertama (${formatDate(shownPreview.startDate)}). ` : ""}Hari libur sesuai jadwal kerja karyawan tidak dihitung.</small></> : <strong>{shownPreview.error}</strong>}</div>}{shownAnnual && <AnnualPreviewBox preview={shownAnnual}/>}<label className="full">Alasan<textarea name="reason" defaultValue={editing?.reason ?? ""} maxLength={500} placeholder="Jelaskan alasan izin atau cuti" required/></label></div>{error && <div className="announcement-inline-error">{error}</div>}<footer><button type="button" className="btn btn-outline btn-sm" onClick={() => setEditing(undefined)}>Batal</button><button className="btn btn-primary btn-sm" disabled={busy || !employeeId || (formType === "special" && (!specialId || shownPreview?.ok === false)) || (formType === "annual" && shownAnnual?.ok === false)}><CalendarPlus size={15}/>{busy ? "Menyimpan..." : "Simpan"}</button></footer></form></LocationModal>}
    {managingKinds && <SpecialLeaveTypesModal kinds={kinds} onChange={(next) => { setKinds(next); setPreview(null); }} onClose={() => setManagingKinds(false)} onCreated={(kind) => { if (editing !== undefined && formType === "special" && !specialId) setSpecialId(kind.id); }}/>}
  </MasterShell>;
}

export function EmployeeCombobox({ employees, value, onChange }: { employees: EmployeeOption[]; value: string; onChange: (id: string) => void }) {
  const selected = employees.find((employee) => employee.id === value), [open, setOpen] = useState(false), [search, setSearch] = useState("");
  const options = employees.filter((employee) => `${employee.name} ${employee.employeeCode} ${employee.department}`.toLowerCase().includes(search.toLowerCase()));
  return <div className="employee-combobox"><button type="button" onClick={() => setOpen((current) => !current)}><span>{selected ? selected.name : "Cari dan pilih karyawan..."}</span><small>{selected ? `${selected.employeeCode} · ${selected.department}` : "⌄"}</small></button>{open && <div className="employee-combobox-popover"><div><Search size={14}/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari nama atau NIK..." autoFocus/></div><ul>{options.map((employee) => <li key={employee.id}><button type="button" onClick={() => { onChange(employee.id); setOpen(false); setSearch(""); }}><strong>{employee.name}</strong><small>{employee.employeeCode} · {employee.department}</small></button></li>)}{!options.length && <li className="no-result">Karyawan tidak ditemukan.</li>}</ul></div>}</div>;
}
/** Second picker shown for Cuti Khusus: the company's own kinds (Menikah, Berduka...). */
function SpecialKindField({ kinds, value, onChange, canManage, onManage, legacyName }: { kinds: SpecialLeaveKind[]; value: string; onChange: (id: string) => void; canManage: boolean; onManage: () => void; legacyName?: string | null }) {
  const selected = kinds.find((kind) => kind.id === value);
  return <label className="full">Jenis Cuti Khusus
    <span className="special-kind-row"><select value={value} onChange={(event) => onChange(event.target.value)} required disabled={!kinds.length}><option value="">{kinds.length ? "Pilih jenis cuti khusus..." : "Belum ada jenis cuti khusus"}</option>{kinds.map((kind) => <option key={kind.id} value={kind.id}>{kind.name}{kind.durationDays ? ` (${kind.durationDays} hari kerja)` : ""}</option>)}</select>{canManage && <button type="button" className="btn btn-outline btn-sm" onClick={onManage}><Plus size={14}/> Kelola Jenis</button>}</span>
    <small className="special-kind-hint">{selected ? `${describeKind(selected)}.${selected.durationDays ? " Cukup pilih tanggal mulai, tanggal selesai dihitung otomatis." : " Pilih tanggal mulai dan selesai."} Tidak mengurangi jatah cuti tahunan.` : legacyName ? `Jenis "${legacyName}" sudah dihapus. Pilih jenis lain.` : kinds.length ? "Cuti khusus tidak mengurangi jatah cuti tahunan." : canManage ? "Klik Kelola Jenis untuk menambahkan, misalnya Menikah, Melahirkan, atau Berduka." : "Hubungi Admin/HRD untuk menambahkan jenis cuti khusus."}</small>
  </label>;
}
function matchesKind(row: LeaveRow, filter: string) {
  if (!filter) return true;
  if (filter.startsWith("special:")) return row.type === "special" && row.specialLeaveName === filter.slice(8);
  return row.type === filter;
}
function durationLabel(row: LeaveRow) { return (row.type === "special" || row.type === "annual") && row.workDays ? `${row.workDays} hari kerja` : `${leaveDays(row.startDate, row.endDate)} hari`; }

/** Remaining Cuti Tahunan in the request form. */
function AnnualPreviewBox({ preview }: { preview: AnnualPreview }) {
  const balance = preview.balance;
  if (!balance) return preview.error ? <div className="full special-preview bad" role="status"><strong>{preview.error}</strong></div> : null;
  const after = preview.ok && preview.workDays ? balance.available - preview.workDays : null;
  return <div className={`full special-preview annual-preview ${preview.ok ? "ok" : "bad"}`} role="status">
    <strong>{preview.ok && preview.workDays ? `${preview.workDays} hari kerja · sisa setelah pengajuan ini ${after} hari` : preview.error ?? `Sisa cuti tahunan ${Math.max(balance.available, 0)} hari kerja`}</strong>
    <small>Sisa cuti tahunan {Math.max(balance.available, 0)} dari {balance.entitled} hari kerja{balance.carried ? ` (termasuk ${balance.carried} hari bawaan periode lalu)` : ""}{balance.pending ? ` · ${balance.pending} hari menunggu persetujuan` : ""} · periode {formatDate(balance.start)} – {formatDate(balance.end)} · reset {formatDate(balance.nextReset)}</small>
  </div>;
}

/** Own Cuti Tahunan for employees, above their request list. */
export function AnnualBalanceCard({ balance }: { balance: AnnualLeaveBalance }) {
  const percent = balance.entitled ? Math.min(100, Math.max(0, Math.round((Math.max(balance.available, 0) / balance.entitled) * 100))) : 0;
  return <section className="annual-balance-card">
    <div><span>Sisa Cuti Tahunan</span><strong>{Math.max(balance.available, 0)}<small> / {balance.entitled} hari kerja</small></strong><div className="annual-balance-bar"><i style={{ width: `${percent}%` }}/></div></div>
    <dl>
      <div><dt>Terpakai</dt><dd>{balance.used} hari</dd></div>
      <div><dt>Menunggu</dt><dd>{balance.pending} hari</dd></div>
      <div><dt>Periode</dt><dd>{formatDate(balance.start)} – {formatDate(balance.end)}</dd></div>
      <div><dt>Reset berikutnya</dt><dd>{formatDate(balance.nextReset)}</dd></div>
    </dl>
    {!balance.eligible && <p>Hak cuti tahunan mulai {formatDate(balance.eligibleFrom)} (setelah 12 bulan kerja).</p>}
    {balance.carried > 0 && <p>Termasuk {balance.carried} hari sisa periode lalu.</p>}
  </section>;
}
function formatDate(value: string) { return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`)); }
