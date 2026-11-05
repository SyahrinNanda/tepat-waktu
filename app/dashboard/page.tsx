import type { Metadata } from "next";
import { and, count, desc, eq } from "drizzle-orm";
import { CalendarClock, CheckCircle2, Clock3, Users } from "lucide-react";
import { db } from "@/db";
import { attendances, employees, leaveRequests } from "@/db/schema";
import { dateInTimeZone, requireCompany } from "@/lib/current-company";
import { StatusBadge } from "@/components/status-badge";
import { EmployeeDashboard } from "@/features/attendance/components/employee-dashboard";
import { MonitorSection } from "@/features/monitor/pages/monitor-page";

export const metadata: Metadata = { title: "Ringkasan" };

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ year?: string; month?: string }> }) {
  const context = await requireCompany();
  const params = await searchParams;
  const today = dateInTimeZone(context.timezone);
  let personalAttendance: { checkIn: string | null; checkOut: string | null; status: "present" | "late" | "absent" | "leave" } | null = null;
  // Everyone except the company admin must check in, so they all get the personal attendance card.
  const mustCheckIn = !context.isSuperAdmin && context.role !== "admin" && context.role !== "owner";
  if (mustCheckIn) {
    let [employee] = await db.select({ id: employees.id }).from(employees).where(and(
      eq(employees.companyId, context.companyId),
      eq(employees.userId, context.session.user.id),
      eq(employees.status, "active"),
    )).limit(1);
    if (!employee) {
      [employee] = await db.select({ id: employees.id }).from(employees).where(and(
        eq(employees.companyId, context.companyId),
        eq(employees.email, context.session.user.email.toLowerCase()),
        eq(employees.status, "active"),
      )).limit(1);
    }
    const [attendance] = employee ? await db.select({
      checkIn: attendances.checkIn,
      checkOut: attendances.checkOut,
      status: attendances.status,
    }).from(attendances).where(and(
      eq(attendances.companyId, context.companyId),
      eq(attendances.employeeId, employee.id),
      eq(attendances.attendanceDate, today),
    )).limit(1) : [];
    personalAttendance = attendance ?? null;
  }
  const [[total], [present], [late], [pending], recent] = await Promise.all([
    db.select({ value: count() }).from(employees).where(and(eq(employees.companyId, context.companyId), eq(employees.status, "active"))),
    db.select({ value: count() }).from(attendances).where(and(eq(attendances.companyId, context.companyId), eq(attendances.attendanceDate, today), eq(attendances.status, "present"))),
    db.select({ value: count() }).from(attendances).where(and(eq(attendances.companyId, context.companyId), eq(attendances.attendanceDate, today), eq(attendances.status, "late"))),
    db.select({ value: count() }).from(leaveRequests).where(and(eq(leaveRequests.companyId, context.companyId), eq(leaveRequests.status, "pending"))),
    db.select({ id: attendances.id, name: employees.name, department: employees.department, checkIn: attendances.checkIn, status: attendances.status })
      .from(attendances).innerJoin(employees, eq(attendances.employeeId, employees.id))
      .where(and(eq(attendances.companyId, context.companyId), eq(attendances.attendanceDate, today))).orderBy(desc(attendances.createdAt)).limit(6),
  ]);
  const recorded = Number(present.value) + Number(late.value);
  const rate = Number(total.value) ? Math.round((recorded / Number(total.value)) * 100) : 0;

  return (
    <>
      {mustCheckIn ? <EmployeeDashboard
        name={context.session.user.name.split(" ")[0]}
        date={new Intl.DateTimeFormat("id-ID", { dateStyle: "full", timeZone: context.timezone }).format(new Date())}
        timezone={context.timezone}
        initialAttendance={personalAttendance}
        display="notice"
      /> : null}
      <div className="page-heading"><div><h1>Selamat datang, {context.session.user.name.split(" ")[0]} 👋</h1><p>Berikut ringkasan kehadiran tim Anda hari ini.</p></div><span className="badge blue">{new Intl.DateTimeFormat("id-ID", { dateStyle: "full", timeZone: context.timezone }).format(new Date())}</span></div>
      <section className="stats-grid">
        <Stat icon={<Users size={19} />} tone="blue" label="Karyawan aktif" value={Number(total.value)} meta="Terdaftar di ruang kerja" />
        <Stat icon={<CheckCircle2 size={19} />} tone="green" label="Hadir hari ini" value={Number(present.value)} meta={`${rate}% dari total karyawan`} />
        <Stat icon={<Clock3 size={19} />} tone="orange" label="Terlambat" value={Number(late.value)} meta="Perlu tindak lanjut" />
        <Stat icon={<CalendarClock size={19} />} tone="red" label="Pengajuan baru" value={Number(pending.value)} meta="Menunggu persetujuan" />
      </section>
      <section className="dashboard-grid">
        <div className="card"><div className="card-head"><div><h2 className="card-title">Kehadiran hari ini</h2><p className="card-subtitle">Pembaruan pencatatan terbaru</p></div></div>
          {recent.length ? <div className="table-wrap"><table className="table"><thead><tr><th>Karyawan</th><th>Jam masuk</th><th>Status</th></tr></thead><tbody>{recent.map((row) => <tr key={row.id}><td><div className="table-user"><span className="avatar">{row.name.slice(0,2).toUpperCase()}</span><span><strong>{row.name}</strong><small>{row.department}</small></span></div></td><td>{row.checkIn?.slice(0,5) ?? "—"}</td><td><StatusBadge value={row.status} /></td></tr>)}</tbody></table></div> : <div className="empty-state"><Clock3 size={28} /><strong>Belum ada pencatatan</strong><span>Kehadiran hari ini akan muncul di sini.</span></div>}
        </div>
        <div className="card"><div className="card-head"><div><h2 className="card-title">Tingkat kehadiran</h2><p className="card-subtitle">Rekap hari ini</p></div></div>
          <div className="donut-wrap"><div className="donut" style={{ "--value": rate } as React.CSSProperties} /><div className="donut-label"><strong>{rate}%</strong><small>TERCATAT</small></div></div>
          <div className="progress-row"><div className="progress-copy"><span>Hadir tepat waktu</span><strong>{Number(present.value)}</strong></div><div className="progress"><i style={{ width: `${rate}%`, background: "var(--green)" }} /></div></div>
          <div className="progress-row"><div className="progress-copy"><span>Terlambat</span><strong>{Number(late.value)}</strong></div><div className="progress"><i style={{ width: `${Number(total.value) ? Number(late.value)/Number(total.value)*100 : 0}%`, background: "var(--orange)" }} /></div></div>
        </div>
      </section>
      {context.role !== "employee" ? <MonitorSection context={context} params={params} /> : null}
    </>
  );
}

function Stat({ icon, tone, label, value, meta }: { icon: React.ReactNode; tone: string; label: string; value: number; meta: string }) {
  return <article className="stat-card"><div className="stat-top"><span className={`stat-icon ${tone}`}>{icon}</span></div><div className="stat-label">{label}</div><div className="stat-value">{value}</div><div className="stat-meta">{meta}</div></article>;
}
