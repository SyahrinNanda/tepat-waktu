import type { Metadata } from "next";
import Link from "next/link";
import { and, count, desc, eq, gte, lt, sql } from "drizzle-orm";
import { BarChart3, CheckCircle2, Clock3, RotateCcw, Users } from "lucide-react";
import { db } from "@/db";
import { attendances, companies, employees, subscriptionPlans } from "@/db/schema";
import { dateInTimeZone, requireCompanyRole } from "@/lib/current-company";

export const metadata: Metadata = { title: "Monitor Perusahaan" };
type Props = { searchParams: Promise<{ year?: string; month?: string }> };
const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

export default async function Page({ searchParams }: Props) {
  const context = await requireCompanyRole(["admin", "general_manager", "hrd", "manager"]);
  const params = await searchParams;
  const today = dateInTimeZone(context.timezone);
  const currentYear = Number(today.slice(0, 4));
  const year = /^20\d{2}$/.test(params.year ?? "") ? Number(params.year) : currentYear;
  const month = /^(0?[1-9]|1[0-2])$/.test(params.month ?? "") ? Number(params.month) : Number(today.slice(5, 7));
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const next = new Date(Date.UTC(year, month, 1));
  const endDate = next.toISOString().slice(0, 10);
  const attendanceFilter = and(eq(attendances.companyId, context.companyId), gte(attendances.attendanceDate, startDate), lt(attendances.attendanceDate, endDate));

  const [[team], byStatus, topLate, topOnTime, genders, [plan]] = await Promise.all([
    db.select({ value: count() }).from(employees).where(and(eq(employees.companyId, context.companyId), eq(employees.status, "active"))),
    db.select({ status: attendances.status, value: count() }).from(attendances).where(attendanceFilter).groupBy(attendances.status),
    rankedEmployees(context.companyId, startDate, endDate, "late"),
    rankedEmployees(context.companyId, startDate, endDate, "present"),
    db.select({ gender: employees.gender, value: count() }).from(employees).where(and(eq(employees.companyId, context.companyId), eq(employees.status, "active"))).groupBy(employees.gender),
    db.select({ name: subscriptionPlans.name, maxEmployees: subscriptionPlans.maxEmployees }).from(companies).leftJoin(subscriptionPlans, eq(companies.plan, subscriptionPlans.code)).where(eq(companies.id, context.companyId)).limit(1),
  ]);
  const status = Object.fromEntries(byStatus.map((item) => [item.status, Number(item.value)]));
  const gender = Object.fromEntries(genders.map((item) => [item.gender, Number(item.value)]));
  const active = Number(team.value);
  const male = gender.male ?? 0, female = gender.female ?? 0, knownGender = male + female;
  const maxEmployees = plan?.maxEmployees ?? Math.max(active, 5);
  const usage = Math.min(100, Math.round(active / Math.max(maxEmployees, 1) * 100));
  const years = Array.from({ length: Math.max(currentYear - 2023 + 1, 1) }, (_, index) => currentYear - index);

  return <>
    <div className="monitor-page-head"><span>Presensi Admin Panel</span><h1>Monitor Perusahaan</h1></div>
    <form className="monitor-global-filter"><select name="year" defaultValue={year}>{years.map((item) => <option key={item}>{item}</option>)}</select><select name="month" defaultValue={month}>{monthNames.map((name, index) => <option key={name} value={index + 1}>{name}</option>)}</select><button type="submit">Terapkan</button><Link href="/dashboard/monitor" aria-label="Reset filter"><RotateCcw size={15} /></Link></form>
    <div className="monitor-layout"><main className="monitor-main">
      <ReportCard icon={<BarChart3 size={17} />} tone="blue" title="Laporan Absen Semua Karyawan" year={year} month={month}>
        <div className="monitor-kpis"><Kpi label="Total Karyawan" value={active} tone="blue" /><Kpi label="Tepat Waktu" value={status.present ?? 0} tone="green" /><Kpi label="Terlambat" value={status.late ?? 0} tone="red" /><Kpi label="Izin" value={status.leave ?? 0} tone="orange" /></div>
        <div className="monitor-attendance-summary"><div><strong>{(status.present ?? 0) + (status.late ?? 0)}</strong><span>Presensi masuk tercatat</span></div><div><strong>{status.absent ?? 0}</strong><span>Tidak hadir</span></div><div><strong>{status.leave ?? 0}</strong><span>Izin / cuti</span></div></div>
      </ReportCard>
      <ReportCard icon={<Clock3 size={17} />} tone="red" title="Laporan 5 Karyawan Terlambat Teratas" year={year} month={month}><Ranking rows={topLate} empty="Belum ada keterlambatan pada periode ini." tone="red" /></ReportCard>
      <ReportCard icon={<CheckCircle2 size={17} />} tone="green" title="Laporan 5 Karyawan Tepat Waktu Teratas" year={year} month={month}><Ranking rows={topOnTime} empty="Belum ada presensi tepat waktu pada periode ini." tone="green" /></ReportCard>
    </main><aside className="monitor-side">
      <section className="monitor-side-card"><h2><i className="blue" />Laporan Limit Karyawan</h2><div className="limit-ring" style={{ "--usage": usage } as React.CSSProperties}><div><strong>{active}</strong><span>dari {maxEmployees}</span></div></div><div className="limit-copy"><span>Karyawan Terpakai</span><b>{active} / {maxEmployees}</b></div><div className="monitor-progress"><i style={{ width: `${usage}%` }} /></div><small>Paket {plan?.name ?? context.plan}</small></section>
      <section className="monitor-side-card"><h2><i className="orange" />Perbandingan Jenis Kelamin</h2><div className="gender-graphic"><Users size={31} /><strong>{knownGender}</strong><span>data terisi</span></div><GenderBar label="Laki-laki" value={male} total={knownGender} tone="blue" /><GenderBar label="Perempuan" value={female} total={knownGender} tone="pink" />{knownGender < active ? <small>{active - knownGender} profil belum mengisi jenis kelamin.</small> : null}</section>
    </aside></div>
  </>;
}

function rankedEmployees(companyId: string, start: string, end: string, status: "late" | "present") {
  return db.select({ id: employees.id, name: employees.name, department: employees.department, value: sql<number>`count(${attendances.id})::int` }).from(attendances)
    .innerJoin(employees, eq(attendances.employeeId, employees.id))
    .where(and(eq(attendances.companyId, companyId), gte(attendances.attendanceDate, start), lt(attendances.attendanceDate, end), eq(attendances.status, status)))
    .groupBy(employees.id, employees.name, employees.department).orderBy(desc(sql`count(${attendances.id})`)).limit(5);
}
function ReportCard({ icon, tone, title, children }: { icon: React.ReactNode; tone: string; title: string; year: number; month: number; children: React.ReactNode }) { return <section className="monitor-report-card"><header><span className={`monitor-report-icon ${tone}`}>{icon}</span><h2>{title}</h2></header>{children}</section>; }
function Kpi({ label, value, tone }: { label: string; value: number; tone: string }) { return <div className={`monitor-kpi ${tone}`}><span>{label}</span><strong>{value}</strong></div>; }
function Ranking({ rows, empty, tone }: { rows: { id: string; name: string; department: string; value: number }[]; empty: string; tone: string }) { return rows.length ? <div className="monitor-ranking">{rows.map((row, index) => <div key={row.id}><b>{index + 1}</b><span><strong>{row.name}</strong><small>{row.department}</small></span><em className={tone}>{row.value} kali</em></div>)}</div> : <div className="monitor-empty"><BarChart3 size={30} /><span>{empty}</span></div>; }
function GenderBar({ label, value, total, tone }: { label: string; value: number; total: number; tone: string }) { const percent = total ? Math.round(value / total * 100) : 0; return <div className="gender-row"><div><span>{label}</span><b>{percent}%</b></div><div className={`gender-bar ${tone}`}><i style={{ width: `${percent}%` }} /></div></div>; }
