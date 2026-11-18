"use client";

import { useMemo, useState, useTransition } from "react";
import Image from "next/image";
import { CircleUserRound, Pencil, Plus, RotateCcw, Search, Trash2, X } from "lucide-react";
import { saveAttendanceRule, saveSalaryBasics, saveSalaryBatch, saveSalaryComponents } from "@/features/employee-salaries/server/actions";
import type { EmployeeAttendanceRule } from "@/features/payslips/server/payslip-calculation";
import { confirmAction } from "@/components/confirm-dialog";

type Unit = "hour" | "day" | "month";
type Kind = "compensation" | "deduction";
type Basis = "hourly" | "daily" | "monthly";
type Component = { id?: string; name: string; unit: Unit; amount: number };
type Row = { id: string; name: string; email: string; position: string; department: string; photoAssetId: string | null; baseSalary: number; overtimeRate: number; salaryBasis: Basis; attendanceRule: EmployeeAttendanceRule; compensations: Component[]; deductions: Component[] };
type Position = { id: string; name: string };

const units: { value: Unit; label: string }[] = [{ value: "hour", label: "Jam" }, { value: "day", label: "Hari" }, { value: "month", label: "Bulan" }];
const money = new Intl.NumberFormat("id-ID");
const bases: { value: Basis; label: string; suffix: string }[] = [{ value: "monthly", label: "Per Bulan", suffix: "/bulan" }, { value: "daily", label: "Per Hari", suffix: "/hari" }, { value: "hourly", label: "Per Jam", suffix: "/jam" }];

export function SalaryManager({ initialRows, positions }: { initialRows: Row[]; positions: Position[] }) {
  const [rows, setRows] = useState(initialRows), [query, setQuery] = useState(""), [department, setDepartment] = useState(""), [pageSize, setPageSize] = useState(25);
  const [modal, setModal] = useState<{ type: "batch" } | { type: Kind | "rule"; employeeId: string } | null>(null);
  const divisions = useMemo(() => [...new Set(rows.map((row) => row.department))].sort(), [rows]);
  const filtered = rows.filter((row) => `${row.name} ${row.email}`.toLowerCase().includes(query.toLowerCase()) && (!department || row.department === department));
  function patchRow(id: string, patch: Partial<Row>) { setRows((current) => current.map((row) => row.id === id ? { ...row, ...patch } : row)); }
  return <>
    <div className="master-page-head salary-page-head"><span>Panel Admin</span><h1>Daftar Gaji Karyawan</h1><p>Beranda / Karyawan / Daftar Gaji Karyawan</p></div>
    <section className="salary-card">
      <div className="salary-toolbar"><div className="master-search"><Search size={16}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nama Karyawan..."/></div><select value={department} onChange={(event) => setDepartment(event.target.value)}><option value="">Pilih Divisi</option>{divisions.map((item) => <option key={item}>{item}</option>)}</select><button className="salary-reset" onClick={() => { setQuery(""); setDepartment(""); }} aria-label="Reset filter"><RotateCcw size={18}/></button><span/><button className="btn btn-primary" onClick={() => setModal({ type: "batch" })}><Pencil size={15}/> Batch Edit</button></div>
      <div className="table-scroll"><table className="salary-table"><thead><tr><th>#</th><th>Foto</th><th>Nama Karyawan</th><th>Divisi–Jabatan</th><th>Basis Gaji</th><th>Upah Lembur</th><th>Upah Gaji</th><th>Kompensasi</th><th>Potongan</th><th>Alpa &amp; Terlambat</th></tr></thead><tbody>{filtered.slice(0, pageSize).map((row, index) => <tr key={row.id}><td>{index + 1}</td><td>{row.photoAssetId ? <Image className="salary-avatar" src={`/api/files/${row.photoAssetId}`} width={48} height={48} unoptimized alt={`Foto ${row.name}`}/> : <CircleUserRound className="salary-avatar-placeholder"/>}</td><td><strong>{row.name}</strong><small>{row.email}</small></td><td><strong>{row.department}</strong><small>{row.position}</small></td><td><select className="salary-basis-select" value={row.salaryBasis} aria-label={`Basis gaji ${row.name}`} onChange={(event) => { const salaryBasis = event.target.value as Basis; patchRow(row.id, { salaryBasis }); void saveSalaryBasics({ employeeId: row.id, baseSalary: row.baseSalary, overtimeRate: row.overtimeRate, salaryBasis }); }}>{bases.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></td><td><InlineMoney value={row.overtimeRate} suffix="/Jam" onSave={(value) => { patchRow(row.id, { overtimeRate: value }); return saveSalaryBasics({ employeeId: row.id, baseSalary: row.baseSalary, overtimeRate: value, salaryBasis: row.salaryBasis }); }}/></td><td><InlineMoney value={row.baseSalary} suffix={bases.find((item) => item.value === row.salaryBasis)?.suffix ?? "/bulan"} onSave={(value) => { patchRow(row.id, { baseSalary: value }); return saveSalaryBasics({ employeeId: row.id, baseSalary: value, overtimeRate: row.overtimeRate, salaryBasis: row.salaryBasis }); }}/></td><td><button className="salary-edit" onClick={() => setModal({ type: "compensation", employeeId: row.id })}><Pencil size={15}/> Edit</button></td><td><button className="salary-edit" onClick={() => setModal({ type: "deduction", employeeId: row.id })}><Pencil size={15}/> Edit</button></td><td><RuleSummary rule={row.attendanceRule}/><button className="salary-rule-edit" onClick={() => setModal({ type: "rule", employeeId: row.id })} aria-label={`Atur alpa dan terlambat ${row.name}`}><Pencil size={13}/> Atur</button></td></tr>)}</tbody></table>{!filtered.length && <div className="salary-empty">Tidak ada karyawan yang cocok.</div>}</div>
      <div className="salary-footer">menampilkan {Math.min(pageSize, filtered.length)} dari {filtered.length} data, Tampilkan {[25, 50, 100].map((size) => <button key={size} type="button" className={pageSize === size ? "active" : ""} aria-pressed={pageSize === size} onClick={() => setPageSize(size)}>{size}</button>)}</div>
    </section>
    {modal?.type === "batch" && <BatchModal positions={positions} onClose={() => setModal(null)} onSaved={() => location.reload()}/>} 
    {modal?.type === "rule" && (() => { const row = rows.find((item) => item.id === modal.employeeId)!; return <RuleModal employee={row} onClose={() => setModal(null)} onSaved={(attendanceRule) => patchRow(row.id, { attendanceRule })}/>; })()}
    {modal && modal.type !== "batch" && modal.type !== "rule" && (() => { const row = rows.find((item) => item.id === modal.employeeId)!; return <ComponentModal kind={modal.type} employee={row} onClose={() => setModal(null)} onSaved={(components) => patchRow(row.id, modal.type === "compensation" ? { compensations: components } : { deductions: components })}/>; })()}
  </>;
}

const lateModes: { value: EmployeeAttendanceRule["lateMode"]; label: string }[] = [{ value: "per_minute", label: "menit" }, { value: "per_hour", label: "jam" }, { value: "per_day", label: "hari" }];

function RuleSummary({ rule }: { rule: EmployeeAttendanceRule }) {
  const absent = rule.absentRule === "manual_only" ? `Alpa manual${rule.absentManualAmount ? ` · Rp ${money.format(rule.absentManualAmount)}/hari` : " · tanpa potongan"}` : "Alpa: ikuti perusahaan";
  const late = rule.lateRule === "none" ? "Terlambat tidak dihitung" : rule.lateRule === "custom" ? `Terlambat Rp ${money.format(rule.lateAmount)}/${lateModes.find((mode) => mode.value === rule.lateMode)?.label}` : "Terlambat: ikuti perusahaan";
  return <span className="salary-rule-summary"><small>{absent}</small><small>{late}</small></span>;
}

function RuleModal({ employee, onClose, onSaved }: { employee: Row; onClose: () => void; onSaved: (rule: EmployeeAttendanceRule) => void }) {
  const [rule, setRule] = useState<EmployeeAttendanceRule>(employee.attendanceRule), [error, setError] = useState(""), [pending, start] = useTransition();
  const set = (patch: Partial<EmployeeAttendanceRule>) => setRule((current) => ({ ...current, ...patch }));
  const amount = (value: string) => Number(value.replace(/\D/g, "")) || 0;
  function submit() {
    if (rule.lateRule === "custom" && rule.lateAmount <= 0) return setError("Isi nominal potongan terlambat, atau pilih \"Tidak dihitung\".");
    start(async () => { try { await saveAttendanceRule({ employeeId: employee.id, ...rule }); onSaved(rule); onClose(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Aturan belum dapat disimpan."); } });
  }
  return <Modal title={`Alpa & Terlambat · ${employee.name}`} onClose={onClose}>
    <fieldset className="salary-rule-group"><legend>Alpa</legend>
      <label><input type="radio" name="absentRule" checked={rule.absentRule === "company"} onChange={() => set({ absentRule: "company" })}/> Ikuti aturan perusahaan<small>Hari kerja tanpa presensi dan tanpa izin dihitung alpa otomatis.</small></label>
      <label><input type="radio" name="absentRule" checked={rule.absentRule === "manual_only"} onChange={() => set({ absentRule: "manual_only" })}/> Hanya alpa manual<small>Untuk jadwal/libur yang berubah tiap pekan. Hari tanpa presensi dianggap Libur; alpa dicatat admin lewat Kehadiran Harian (status Alpa).</small></label>
      {rule.absentRule === "manual_only" && <label className="salary-rule-amount">Potongan per hari alpa manual<span><b>Rp</b><input inputMode="numeric" value={rule.absentManualAmount ? money.format(rule.absentManualAmount) : ""} placeholder="0 = tidak dipotong" onChange={(event) => set({ absentManualAmount: amount(event.target.value) })}/><b>/hari</b></span></label>}
    </fieldset>
    <fieldset className="salary-rule-group"><legend>Terlambat</legend>
      <label><input type="radio" name="lateRule" checked={rule.lateRule === "company"} onChange={() => set({ lateRule: "company" })}/> Ikuti aturan perusahaan</label>
      <label><input type="radio" name="lateRule" checked={rule.lateRule === "none"} onChange={() => set({ lateRule: "none" })}/> Tidak dihitung<small>Keterlambatan tetap tercatat di laporan, tetapi gaji tidak dipotong.</small></label>
      <label><input type="radio" name="lateRule" checked={rule.lateRule === "custom"} onChange={() => set({ lateRule: "custom" })}/> Potongan khusus</label>
      {rule.lateRule === "custom" && <label className="salary-rule-amount">Potong<span><b>Rp</b><input inputMode="numeric" value={rule.lateAmount ? money.format(rule.lateAmount) : ""} placeholder="Nominal" onChange={(event) => set({ lateAmount: amount(event.target.value) })}/><select value={rule.lateMode} onChange={(event) => set({ lateMode: event.target.value as EmployeeAttendanceRule["lateMode"] })} aria-label="Satuan potongan terlambat">{lateModes.map((mode) => <option key={mode.value} value={mode.value}>per {mode.label}</option>)}</select></span><small>Per jam: setiap jam yang dimulai dihitung (terlambat 61 menit = 2 jam).</small></label>}
    </fieldset>
    {error && <p className="salary-error" role="alert">{error}</p>}
    <footer className="salary-rule-footer"><button type="button" className="btn btn-outline" onClick={onClose}>Batal</button><button type="button" className="btn btn-primary" disabled={pending} onClick={submit}>{pending ? "Menyimpan..." : "SIMPAN ATURAN"}</button></footer>
  </Modal>;
}

function InlineMoney({ value, suffix, onSave }: { value: number; suffix: string; onSave: (value: number) => Promise<unknown> }) {
  const [text, setText] = useState(money.format(value)), [pending, start] = useTransition();
  return <div className="salary-money"><input value={text} disabled={pending} inputMode="numeric" onChange={(event) => setText(money.format(Number(event.target.value.replace(/\D/g, ""))))} onBlur={() => { const next = Number(text.replace(/\D/g, "")); if (next !== value) start(async () => { await onSave(next); }); }}/><span>{pending ? "..." : suffix}</span></div>;
}

function ComponentModal({ kind, employee, onClose, onSaved }: { kind: Kind; employee: Row; onClose: () => void; onSaved: (items: Component[]) => void }) {
  const [items, setItems] = useState<Component[]>(kind === "compensation" ? employee.compensations : employee.deductions);
  const [draft, setDraft] = useState<Component>({ name: "", unit: "month", amount: 0 });
  const [error, setError] = useState(""), [pending, start] = useTransition();
  function add() { if (!draft.name.trim() || draft.amount < 0) return setError("Isi nama komponen, tipe, dan nominal."); if (items.some((item) => item.name.toLowerCase() === draft.name.trim().toLowerCase())) return setError("Komponen tersebut sudah ada di daftar."); setItems((current) => [...current, { ...draft, name: draft.name.trim() }]); setDraft({ name: "", unit: "month", amount: 0 }); setError(""); }
  function submit() { start(async () => { try { await saveSalaryComponents({ employeeId: employee.id, type: kind, components: items }); onSaved(items); onClose(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Data belum dapat disimpan."); } }); }
  return <Modal title={kind === "compensation" ? "List Kompensasi" : "List Potongan"} onClose={onClose} wide><div className="salary-component-entry"><input className="salary-name-input" placeholder={kind === "compensation" ? "Nama kompensasi (mis. Tunjangan Transport)" : "Nama potongan (mis. BPJS)"} maxLength={100} value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}/><input inputMode="numeric" placeholder={`Nominal ${kind === "compensation" ? "kompensasi" : "potongan"}`} value={draft.amount || ""} onChange={(event) => setDraft((current) => ({ ...current, amount: Number(event.target.value.replace(/\D/g, "")) }))}/><select value={draft.unit} onChange={(event) => setDraft((current) => ({ ...current, unit: event.target.value as Unit }))}><option value="" disabled>Tipe {kind === "compensation" ? "Kompensasi" : "Potongan"}</option>{units.map((unit) => <option key={unit.value} value={unit.value}>{unit.label}</option>)}</select><button onClick={add} aria-label="Tambah komponen"><Plus size={20}/></button></div><div className="salary-component-list">{items.map((item, index) => <div key={`${item.name}-${index}`}><span><strong>{item.name}</strong><small>Per {units.find((unit) => unit.value === item.unit)?.label}</small></span><b>Rp {money.format(item.amount)}</b><button onClick={() => setItems((current) => current.filter((_, itemIndex) => itemIndex !== index))}><Trash2 size={16}/></button></div>)}{!items.length && <p>“Tidak Ada Data...”</p>}</div>{error && <div className="salary-error">{error}</div>}<footer><button className="salary-save" disabled={pending} onClick={submit}>{pending ? "MENYIMPAN..." : kind === "compensation" ? "SIMPAN KOMPENSASI" : "SIMPAN POTONGAN"}</button></footer></Modal>;
}

function BatchModal({ positions, onClose, onSaved }: { positions: Position[]; onClose: () => void; onSaved: () => void }) {
  const [positionId, setPositionId] = useState(""), [salaryBasis, setSalaryBasis] = useState<Basis>("monthly"), [baseSalary, setBaseSalary] = useState(0), [overtimeRate, setOvertimeRate] = useState(0), [compensations, setCompensations] = useState<Component[]>([]), [deductions, setDeductions] = useState<Component[]>([]), [error, setError] = useState(""), [pending, start] = useTransition();
  // Batch edit replaces every active member's pay setup in the position, including their own allowances
  // and deductions, so the admin confirms that first.
  async function submit() {
    const name = positions.find((position) => position.id === positionId)?.name ?? "ini";
    if (!await confirmAction(`Terapkan ke semua karyawan aktif di jabatan ${name}? Kompensasi dan potongan yang sudah diatur per karyawan akan diganti dengan isian ini.`, "Terapkan ke Jabatan?", "Ya, Terapkan")) return;
    start(async () => { try { await saveSalaryBatch({ positionId, baseSalary, overtimeRate, salaryBasis, compensations, deductions }); onSaved(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Batch edit gagal."); } });
  }
  return <Modal title="Edit Gaji" onClose={onClose} wide><label className="salary-batch-field">Pilih Jabatan<select value={positionId} onChange={(event) => setPositionId(event.target.value)}><option value="">Pilih Jabatan</option>{positions.map((position) => <option key={position.id} value={position.id}>{position.name}</option>)}</select></label><label className="salary-batch-field">Basis Gaji<select value={salaryBasis} onChange={(event) => setSalaryBasis(event.target.value as Basis)}>{bases.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label><div className="salary-batch-money"><label>Upah Lembur<div><input inputMode="numeric" value={overtimeRate || ""} placeholder="Upah Lembur" onChange={(event) => setOvertimeRate(Number(event.target.value.replace(/\D/g, "")))}/><span>/Jam</span></div></label><label>Upah Gaji<div><input inputMode="numeric" value={baseSalary || ""} placeholder="Upah Gaji" onChange={(event) => setBaseSalary(Number(event.target.value.replace(/\D/g, "")))}/><span>{bases.find((item) => item.value === salaryBasis)?.suffix}</span></div></label></div><BatchComponentRow label="Kompensasi" kind="compensation" items={compensations} setItems={setCompensations}/><BatchComponentRow label="Potongan" kind="deduction" items={deductions} setItems={setDeductions}/><p className="salary-batch-warning">Berlaku untuk semua karyawan aktif di jabatan terpilih: gaji, upah lembur, kompensasi, dan potongan mereka diganti dengan isian ini. Kompensasi atau potongan yang sudah diatur per karyawan akan terhapus.</p>{error && <div className="salary-error">{error}</div>}<footer className="salary-batch-footer"><button className="btn btn-primary" disabled={pending || !positionId} onClick={() => void submit()}>{pending ? "Menyimpan..." : "SIMPAN"}</button></footer></Modal>;
}

function BatchComponentRow({ label, items, setItems }: { label: string; kind: Kind; items: Component[]; setItems: (items: Component[]) => void }) {
  const [draft, setDraft] = useState<Component>({ name: "", unit: "month", amount: 0 });
  return <div className="salary-batch-components"><label>{label}</label><div><input className="salary-name-input" placeholder={`Nama ${label.toLowerCase()}`} maxLength={100} value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}/><select value={draft.unit} onChange={(event) => setDraft((current) => ({ ...current, unit: event.target.value as Unit }))}>{units.map((unit) => <option key={unit.value} value={unit.value}>{unit.label}</option>)}</select><input inputMode="numeric" value={draft.amount || ""} placeholder={`Nominal ${label}`} onChange={(event) => setDraft((current) => ({ ...current, amount: Number(event.target.value.replace(/\D/g, "")) }))}/><button onClick={() => { if (draft.name.trim()) { setItems([...items, { ...draft, name: draft.name.trim() }]); setDraft({ name: "", unit: "month", amount: 0 }); } }}><Plus size={18}/></button></div>{items.length ? <ul>{items.map((item, index) => <li key={`${item.name}-${index}`}>{item.name} · Rp {money.format(item.amount)} / {item.unit}<button onClick={() => setItems(items.filter((_, itemIndex) => itemIndex !== index))}><X size={13}/></button></li>)}</ul> : <p>“Tidak Ada Data...”</p>}</div>;
}

function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) { return <div className="salary-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className={`salary-modal ${wide ? "wide" : ""}`} role="dialog" aria-modal="true" aria-label={title}><header><h2>{title}</h2><button onClick={onClose}><X size={18}/></button></header><div className="salary-modal-body">{children}</div></section></div>; }
