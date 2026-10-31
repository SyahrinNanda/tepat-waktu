"use client";

import { useMemo, useRef, useState } from "react";
import { Download, FileImage, FileText, Filter, Pencil, Plus, RotateCcw, Search, Trash2, UploadCloud } from "lucide-react";
import { ConfirmDialog, confirmAction } from "@/components/confirm-dialog";
import { EmployeeCombobox, type EmployeeOption } from "@/features/leave-requests/components/leave-request-manager";
import { MasterShell } from "@/features/master-data/shifts/components/shift-manager";
import { LocationModal } from "@/features/master-data/shared/location-modal";

type Status = "pending" | "approved" | "rejected";
export type ExpenseClaimRow = { id: string; employeeId: string; name: string; employeeCode: string; department: string; requestDate: string; amount: number; description: string; note: string | null; proofAssetId: string | null; status: Status };
const labels: Record<Status, string> = { pending: "Menunggu", approved: "Disetujui", rejected: "Ditolak" };

export function ExpenseClaimManager({ initialRows, employees, canReview, today }: { initialRows: ExpenseClaimRow[]; employees: EmployeeOption[]; canReview: boolean; today: string }) {
  const [rows, setRows] = useState(initialRows), [query, setQuery] = useState(""), [status, setStatus] = useState<Status | "">(""), [showFilters, setShowFilters] = useState(false);
  const [editing, setEditing] = useState<ExpenseClaimRow | null | undefined>(), [employeeId, setEmployeeId] = useState(""), [selectedIds, setSelectedIds] = useState<string[]>([]), [deleteTarget, setDeleteTarget] = useState<ExpenseClaimRow | null>(null);
  const [proof, setProof] = useState<File | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const filtered = useMemo(() => rows.filter((row) => `${row.name} ${row.employeeCode} ${row.description}`.toLowerCase().includes(query.toLowerCase()) && (!status || row.status === status)), [rows, query, status]);
  const pending = filtered.filter((row) => row.status === "pending");

  function open(row: ExpenseClaimRow | null) { setError(""); setEditing(row); setProof(null); setEmployeeId(row?.employeeId ?? (employees.length === 1 ? employees[0].id : "")); }
  async function uploadProof() {
    if (!proof) return editing?.proofAssetId ?? null;
    const form = new FormData(); form.set("module", "pengajuan/klaim-beban"); form.set("file", proof);
    const response = await fetch("/api/feature-uploads", { method: "POST", body: form }); const payload = await response.json();
    if (!response.ok) throw new Error(payload.error ?? "Bukti belum dapat diunggah."); return String(payload.id);
  }
  async function save(form: FormData) {
    setBusy(true); setError("");
    try {
      const proofAssetId = await uploadProof();
      const body = { employeeId, requestDate: String(form.get("requestDate")), amount: Number(form.get("amount")), description: String(form.get("description")), note: String(form.get("note")), proofAssetId };
      const response = await fetch(editing ? `/api/expense-claims/${editing.id}` : "/api/expense-claims", { method: editing ? "PATCH" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const payload = await response.json(); if (!response.ok) throw new Error(payload.error ?? "Klaim belum dapat disimpan.");
      setRows((current) => editing ? current.map((row) => row.id === payload.row.id ? { ...row, ...payload.row } : row) : [payload.row, ...current]); setEditing(undefined);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Server tidak dapat dihubungi."); } finally { setBusy(false); }
  }
  async function review(nextStatus: "approved" | "rejected") {
    if (!selectedIds.length || !await confirmAction(`${nextStatus === "approved" ? "Setujui" : "Tolak"} ${selectedIds.length} klaim terpilih?`, "Konfirmasi Klaim")) return;
    setBusy(true); const response = await fetch("/api/expense-claims", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ ids: selectedIds, status: nextStatus }) }); const payload = await response.json();
    if (response.ok) { const ids = new Set(payload.rows.map((row: { id: string }) => row.id)); setRows((current) => current.map((row) => ids.has(row.id) ? { ...row, status: nextStatus } : row)); setSelectedIds([]); } else setError(payload.error); setBusy(false);
  }
  async function remove() { if (!deleteTarget) return; setBusy(true); const response = await fetch(`/api/expense-claims/${deleteTarget.id}`, { method: "DELETE" }); const payload = await response.json(); if (response.ok) { setRows((current) => current.filter((row) => row.id !== deleteTarget.id)); setDeleteTarget(null); } else setError(payload.error); setBusy(false); }
  function exportCsv() { const quote = (value: unknown) => `"${String(value).replaceAll('"', '""')}"`; const csv = `\uFEFFTanggal,Karyawan,Nominal,Keterangan,Status\r\n${filtered.map((row) => [row.requestDate, row.name, row.amount, row.description, labels[row.status]].map(quote).join(",")).join("\r\n")}`; const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })); const link = document.createElement("a"); link.href = url; link.download = "klaim-beban.csv"; link.click(); URL.revokeObjectURL(url); }

  return <MasterShell title="DAFTAR PENGAJUAN KLAIM BEBAN" breadcrumb="Beranda / Pengajuan / Daftar Pengajuan Klaim Beban">
    <section className="leave-reference-card expense-claim-card">
      <div className="leave-primary-toolbar"><div className="master-search"><Search size={16}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari nama karyawan..."/></div><button className={`leave-filter-button ${showFilters ? "active" : ""}`} onClick={() => setShowFilters((value) => !value)}><Filter size={19}/> Filter</button><button className="btn btn-primary" onClick={exportCsv}><Download size={16}/> Ekspor Excel</button><span/>{canReview && <><button className="btn btn-outline" disabled={!selectedIds.length || busy} onClick={() => void review("rejected")}>Tolak</button><button className="btn btn-primary" disabled={!selectedIds.length || busy} onClick={() => void review("approved")}>Setujui</button></>}<button className="btn btn-primary" onClick={() => open(null)}><Plus size={16}/> Tambah</button></div>
      {showFilters && <div className="leave-filter-row"><div className="leave-status-tabs">{(["pending", "approved", "rejected"] as Status[]).map((item) => <button key={item} className={status === item ? "active" : ""} onClick={() => setStatus(status === item ? "" : item)}>{labels[item]}</button>)}</div><button className="leave-reset" onClick={() => { setQuery(""); setStatus(""); }}><RotateCcw size={17}/> Reset Filter</button></div>}
      {error && editing === undefined && <div className="announcement-inline-error">{error}</div>}
      {filtered.length ? <div className="table-scroll"><table className="master-reference-table leave-table"><thead><tr>{canReview && <th><input type="checkbox" checked={pending.length > 0 && pending.every((row) => selectedIds.includes(row.id))} onChange={(event) => setSelectedIds(event.target.checked ? pending.map((row) => row.id) : [])}/></th>}<th>#</th><th>Tgl Pengajuan</th><th>Karyawan</th><th>Foto</th><th>Nominal</th><th>Keterangan</th><th>Status</th><th>Aksi</th></tr></thead><tbody>{filtered.map((row, index) => <tr key={row.id}>{canReview && <td><input type="checkbox" disabled={row.status !== "pending"} checked={selectedIds.includes(row.id)} onChange={() => setSelectedIds((ids) => ids.includes(row.id) ? ids.filter((id) => id !== row.id) : [...ids, row.id])}/></td>}<td>{index + 1}</td><td>{formatDate(row.requestDate)}</td><td><strong>{row.name}</strong><small>{row.employeeCode} · {row.department}</small></td><td>{row.proofAssetId ? <a className="claim-proof" href={`/api/files/${row.proofAssetId}`} target="_blank"><FileImage size={16}/> Lihat</a> : "—"}</td><td>{money(row.amount)}</td><td><strong>{row.description}</strong>{row.note && <small>{row.note}</small>}</td><td><span className={`leave-status ${row.status}`}>{labels[row.status]}</span></td><td><div className="master-actions icon-actions"><button disabled={row.status !== "pending"} onClick={() => open(row)}><Pencil size={14}/></button>{canReview && <button className="danger" onClick={() => setDeleteTarget(row)}><Trash2 size={14}/></button>}</div></td></tr>)}</tbody></table></div> : <div className="location-empty leave-empty"><FileText size={48}/><strong>Data Kosong</strong></div>}
    </section>
    {editing !== undefined && <LocationModal title={editing ? "Edit Pengajuan Klaim Beban" : "Tambah Pengajuan Klaim Beban"} onClose={() => setEditing(undefined)}><form action={save} className="leave-modal-form expense-claim-form"><div className="leave-modal-grid"><label className="full">Nama Karyawan<EmployeeCombobox employees={employees} value={employeeId} onChange={setEmployeeId}/></label><label>Tanggal<input name="requestDate" type="date" defaultValue={editing?.requestDate ?? today} required/></label><label>Nominal<input name="amount" type="number" min="1000" max="2000000000" step="1000" defaultValue={editing?.amount ?? ""} placeholder="Masukan nominal..." required/></label><label className="full">Deskripsi<input name="description" defaultValue={editing?.description ?? ""} placeholder="Masukan deskripsi..." required/></label><label className="full">Catatan (Opsional)<textarea name="note" defaultValue={editing?.note ?? ""} placeholder="Ketikan catatan disini..."/></label><div className="full claim-upload"><span>Foto</span><input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" hidden onChange={(event) => setProof(event.target.files?.[0] ?? null)}/><button type="button" onClick={() => fileRef.current?.click()}><UploadCloud size={28}/><span>{proof?.name ?? (editing?.proofAssetId ? "Bukti tersimpan — pilih untuk mengganti" : "Upload Foto")}</span><b>Cari Foto</b></button></div></div>{error && <div className="announcement-inline-error">{error}</div>}<footer><button type="button" className="btn btn-outline btn-sm" onClick={() => setEditing(undefined)}>Batal</button><button className="btn btn-primary btn-sm" disabled={busy || !employeeId}>{busy ? "Menyimpan..." : "Simpan"}</button></footer></form></LocationModal>}
    <ConfirmDialog open={Boolean(deleteTarget)} title="Hapus Klaim Beban?" message={`Klaim ${deleteTarget?.name ?? "karyawan"} sebesar ${money(deleteTarget?.amount ?? 0)} akan dihapus permanen.`} busy={busy} onCancel={() => setDeleteTarget(null)} onConfirm={remove}/>
  </MasterShell>;
}

const money = (value: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value);
const formatDate = (value: string) => new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(new Date(`${value}T00:00:00`));
