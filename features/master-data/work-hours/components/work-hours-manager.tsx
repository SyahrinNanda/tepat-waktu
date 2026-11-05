"use client";

import { useMemo, useState } from "react";
import { RotateCcw, Save, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { MasterShell, type ShiftRow } from "@/features/master-data/shifts/components/shift-manager";

type DayRow = { id?: string; scheduleId: string; dayOfWeek: number; enabled: boolean; startTime: string; endTime: string };
const dayNames = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];
const defaultDays = (scheduleId: string): DayRow[] => dayNames.map((_, index) => ({ scheduleId, dayOfWeek: index + 1, enabled: index < 5, startTime: "08:00:00", endTime: "17:00:00" }));

export function WorkHoursManager({ shifts, initialDays, canManage }: { shifts: ShiftRow[]; initialDays: DayRow[]; canManage: boolean }) {
  const [selected, setSelected] = useState("");
  const [days, setDays] = useState(initialDays);
  const [deleteTarget, setDeleteTarget] = useState<ShiftRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const visibleShifts = useMemo(() => selected ? shifts.filter((shift) => shift.id === selected) : shifts, [selected, shifts]);
  const daysFor = (scheduleId: string) => dayNames.map((_, index) => days.find((day) => day.scheduleId === scheduleId && day.dayOfWeek === index + 1) ?? defaultDays(scheduleId)[index]);

  function change(scheduleId: string, dayIndex: number, key: "enabled" | "startTime" | "endTime", value: boolean | string) {
    const next = daysFor(scheduleId).map((day, index) => index === dayIndex ? { ...day, [key]: value } : day);
    setDays((current) => [...current.filter((day) => day.scheduleId !== scheduleId), ...next]);
  }

  async function save() {
    if (!visibleShifts.length) return;
    setBusy(true); setMessage("");
    try {
      for (const shift of visibleShifts) {
        const response = await fetch("/api/master/work-hours", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ scheduleId: shift.id, days: daysFor(shift.id).map((day) => ({ ...day, startTime: day.startTime.slice(0, 5), endTime: day.endTime.slice(0, 5) })) }) });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? `Gagal menyimpan shift ${shift.name}.`);
      }
      setMessage(`${visibleShifts.length} pengaturan jam kerja berhasil disimpan.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Gagal menyimpan jam kerja."); }
    finally { setBusy(false); }
  }

  async function remove() {
    if (!deleteTarget) return;
    setBusy(true);
    const response = await fetch(`/api/master/work-hours?scheduleId=${deleteTarget.id}`, { method: "DELETE" });
    const payload = await response.json().catch(() => ({}));
    if (response.ok) { setDays((current) => current.filter((day) => day.scheduleId !== deleteTarget.id)); setMessage(`Jam kerja ${deleteTarget.name} dihapus.`); setDeleteTarget(null); }
    else setMessage(payload.error ?? "Gagal menghapus jam kerja.");
    setBusy(false);
  }

  return <MasterShell title="DAFTAR JAM KERJA" breadcrumb="Beranda / Manajemen Hari dan Waktu Kerja / Daftar Hari dan Waktu Kerja">
    <section className="master-reference-card work-hours-card">
      <div className="work-filter"><label>Filter Jadwal Kerja<select value={selected} onChange={(event) => setSelected(event.target.value)}><option value="">Semua Jadwal Kerja</option>{shifts.map((shift) => <option value={shift.id} key={shift.id}>{shift.name}</option>)}</select></label><button type="button" aria-label="Reset filter" onClick={() => setSelected("")}><RotateCcw size={17}/></button></div>
      {visibleShifts.length ? <><div className="work-hours-table-wrap"><table className="work-hours-table"><thead><tr><th>#</th><th>Jadwal Kerja</th>{dayNames.map((name) => <th key={name}>{name}</th>)}<th>Aksi</th></tr></thead><tbody>{visibleShifts.map((shift, rowIndex) => <tr key={shift.id}><td>{rowIndex + 1}</td><td><span className="shift-pill">{shift.name}</span></td>{daysFor(shift.id).map((day, dayIndex) => <td key={day.dayOfWeek}><label className="day-enabled"><input type="checkbox" checked={day.enabled} disabled={!canManage} onChange={(event) => change(shift.id, dayIndex, "enabled", event.target.checked)}/><span>{day.enabled ? "Aktif" : "Libur"}</span></label><small>MASUK</small><input type="time" value={day.startTime.slice(0, 5)} disabled={!canManage || !day.enabled} onChange={(event) => change(shift.id, dayIndex, "startTime", event.target.value)}/><small>PULANG</small><input type="time" value={day.endTime.slice(0, 5)} disabled={!canManage || !day.enabled} onChange={(event) => change(shift.id, dayIndex, "endTime", event.target.value)}/></td>)}<td>{canManage && <button className="icon-danger" onClick={() => setDeleteTarget(shift)} aria-label={`Hapus jam kerja ${shift.name}`}><Trash2 size={17}/></button>}</td></tr>)}</tbody></table></div>{message && <div className={message.includes("berhasil") || message.includes("dihapus") ? "success-box" : "error-box"}>{message}</div>}{canManage && <button className="btn btn-primary work-save" onClick={save} disabled={busy}><Save size={16}/>{busy ? "Menyimpan..." : selected ? "Simpan" : "Simpan Semua"}</button>}</> : <div className="master-empty">Belum ada shift. Tambahkan shift pada menu Master Data → Jadwal Kerja.</div>}
    </section>
    <ConfirmDialog open={Boolean(deleteTarget)} title="Hapus Hari dan Waktu Kerja?" message={`Seluruh pengaturan jam kerja untuk shift ${deleteTarget?.name ?? "ini"} akan dihapus.`} busy={busy} onCancel={() => setDeleteTarget(null)} onConfirm={remove}/>
  </MasterShell>;
}
