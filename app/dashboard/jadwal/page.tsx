import type { Metadata } from "next";
import { asc, eq } from "drizzle-orm";
import { CalendarDays, Clock3, Plus } from "lucide-react";
import { db } from "@/db";
import { workSchedules } from "@/db/schema";
import { requireCompanyRole } from "@/lib/current-company";
import { createSchedule } from "@/features/workforce/server/actions";

export const metadata: Metadata = { title: "Jadwal kerja" };

export default async function SchedulesPage() {
  const context = await requireCompanyRole(["admin", "general_manager", "hrd"]);
  const rows = await db.select().from(workSchedules).where(eq(workSchedules.companyId, context.companyId)).orderBy(asc(workSchedules.startTime));
  return (
    <>
      <div className="page-heading"><div><h1>Jadwal kerja</h1><p>Atur jam operasional dan toleransi keterlambatan.</p></div></div>
      <section className="card section-card modal-card">
        <div className="card-head"><div><h2 className="card-title">Buat jadwal</h2><p className="card-subtitle">Jadwal dapat digunakan sebagai acuan pencatatan.</p></div><span className="stat-icon blue"><CalendarDays size={18} /></span></div>
        <form action={createSchedule} className="form-grid">
          <Field label="Nama jadwal"><input className="input" name="name" placeholder="Reguler kantor" required /></Field>
          <Field label="Hari kerja"><input className="input" name="workDays" defaultValue="Senin–Jumat" required /></Field>
          <Field label="Jam masuk"><input className="input" name="startTime" type="time" defaultValue="08:00" required /></Field>
          <Field label="Jam pulang"><input className="input" name="endTime" type="time" defaultValue="17:00" required /></Field>
          <Field label="Toleransi (menit)"><input className="input" name="graceMinutes" type="number" min="0" max="120" defaultValue="15" required /></Field>
          <div className="action-row" style={{ alignItems: "center" }}><button className="btn btn-primary"><Plus size={16} /> Simpan jadwal</button></div>
        </form>
      </section>
      <section className="card"><div className="card-head"><div><h2 className="card-title">Daftar jadwal</h2><p className="card-subtitle">{rows.length} pola kerja tersimpan</p></div></div>
        {rows.length ? <div className="table-wrap"><table className="table"><thead><tr><th>Nama</th><th>Hari kerja</th><th>Jam kerja</th><th>Toleransi</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td><strong>{row.name}</strong></td><td>{row.workDays}</td><td>{row.startTime.slice(0,5)} – {row.endTime.slice(0,5)}</td><td><span className="badge orange">{row.graceMinutes} menit</span></td></tr>)}</tbody></table></div> : <div className="empty-state"><Clock3 size={28} /><strong>Belum ada jadwal</strong><span>Buat pola jam kerja pertama untuk tim.</span></div>}
      </section>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="field"><span className="field-label">{label}</span>{children}</div>; }
