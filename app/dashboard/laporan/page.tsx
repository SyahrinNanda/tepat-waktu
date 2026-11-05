import type { Metadata } from "next";
import { and, count, eq, gte, sql } from "drizzle-orm";
import { BarChart3, CalendarCheck, Clock3, UserRoundX } from "lucide-react";
import { db } from "@/db";
import { attendances, employees } from "@/db/schema";
import { dateInTimeZone, requireCompany } from "@/lib/current-company";

export const metadata: Metadata = { title: "Laporan" };

export default async function ReportsPage() {
  const context = await requireCompany();
  const today = dateInTimeZone(context.timezone);
  // 30-day window ending today in the company zone; plain calendar math, no fixed UTC offset.
  const start = new Date(`${today}T00:00:00Z`); start.setUTCDate(start.getUTCDate() - 29);
  const startDate = start.toISOString().slice(0, 10);
  const [byStatus, [active], byDepartment] = await Promise.all([
    db.select({ status: attendances.status, value: count() }).from(attendances).where(and(eq(attendances.companyId, context.companyId), gte(attendances.attendanceDate, startDate))).groupBy(attendances.status),
    db.select({ value: count() }).from(employees).where(and(eq(employees.companyId, context.companyId), eq(employees.status, "active"))),
    db.select({ department: employees.department, value: count() }).from(employees).where(and(eq(employees.companyId, context.companyId), eq(employees.status, "active"))).groupBy(employees.department).orderBy(sql`count(*) desc`),
  ]);
  const stats = Object.fromEntries(byStatus.map((row) => [row.status, Number(row.value)]));
  const totalRecords = byStatus.reduce((sum, row) => sum + Number(row.value), 0);
  const presenceRate = totalRecords ? Math.round(((stats.present ?? 0) + (stats.late ?? 0)) / totalRecords * 100) : 0;
  const maxDepartment = Math.max(...byDepartment.map((row) => Number(row.value)), 1);
  return (
    <>
      <div className="page-heading"><div><h1>Laporan 30 hari</h1><p>Gambaran singkat pola kehadiran dan komposisi tim.</p></div><span className="badge blue">{formatDate(startDate)} – {formatDate(today)}</span></div>
      <section className="stats-grid">
        <Stat icon={<CalendarCheck size={19} />} tone="green" label="Tingkat hadir" value={`${presenceRate}%`} meta="Hadir dan terlambat" />
        <Stat icon={<BarChart3 size={19} />} tone="blue" label="Total pencatatan" value={String(totalRecords)} meta="Dalam 30 hari terakhir" />
        <Stat icon={<Clock3 size={19} />} tone="orange" label="Terlambat" value={String(stats.late ?? 0)} meta="Pencatatan terlambat" />
        <Stat icon={<UserRoundX size={19} />} tone="red" label="Tidak hadir" value={String(stats.absent ?? 0)} meta="Tanpa kehadiran" />
      </section>
      <section className="dashboard-grid">
        <div className="card"><div className="card-head"><div><h2 className="card-title">Komposisi departemen</h2><p className="card-subtitle">Distribusi {Number(active.value)} karyawan aktif</p></div></div>
          {byDepartment.length ? byDepartment.map((row) => <div className="progress-row" key={row.department}><div className="progress-copy"><span>{row.department}</span><strong>{Number(row.value)}</strong></div><div className="progress"><i style={{ width: `${Number(row.value)/maxDepartment*100}%`, background: "var(--primary)" }} /></div></div>) : <div className="empty-state">Belum ada data karyawan.</div>}
        </div>
        <div className="card"><div className="card-head"><div><h2 className="card-title">Ringkasan status</h2><p className="card-subtitle">Seluruh pencatatan periode ini</p></div></div>
          <ReportRow label="Hadir" value={stats.present ?? 0} color="var(--green)" total={totalRecords} />
          <ReportRow label="Terlambat" value={stats.late ?? 0} color="var(--orange)" total={totalRecords} />
          <ReportRow label="Tidak hadir" value={stats.absent ?? 0} color="var(--red)" total={totalRecords} />
          <ReportRow label="Cuti" value={stats.leave ?? 0} color="var(--primary)" total={totalRecords} />
        </div>
      </section>
    </>
  );
}

function Stat({ icon, tone, label, value, meta }: { icon: React.ReactNode; tone: string; label: string; value: string; meta: string }) { return <article className="stat-card"><span className={`stat-icon ${tone}`}>{icon}</span><div className="stat-label">{label}</div><div className="stat-value">{value}</div><div className="stat-meta">{meta}</div></article>; }
function ReportRow({ label, value, total, color }: { label: string; value: number; total: number; color: string }) { return <div className="progress-row"><div className="progress-copy"><span>{label}</span><strong>{value}</strong></div><div className="progress"><i style={{ width: `${total ? value/total*100 : 0}%`, background: color }} /></div></div>; }
function formatDate(value: string) { return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`)); }
