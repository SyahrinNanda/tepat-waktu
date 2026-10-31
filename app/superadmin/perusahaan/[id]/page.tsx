import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, count, desc, eq, gte, inArray } from "drizzle-orm";
import { Activity, Building2, ShieldCheck, Users } from "lucide-react";
import { db } from "@/db";
import { attendances, companies, companyMembers, employees, leaveRequests, subscriptionPlans, user, workSchedules } from "@/db/schema";
import { enterCompany } from "../../actions";
import { setCompanyPlan } from "../actions";

export const metadata: Metadata = { title: "Detail Perusahaan" };
type Props = { params: Promise<{ id: string }> };

export default async function Page({ params }: Props) {
  const { id } = await params;
  const [company] = await db.select().from(companies).where(eq(companies.id, id)).limit(1);
  if (!company) notFound();
  const monthStart = new Date(); monthStart.setUTCDate(1); monthStart.setUTCHours(0, 0, 0, 0);
  const monthStartDate = monthStart.toISOString().slice(0, 10);
  const [[employeeCount], [activeCount], [memberCount], [attendanceCount], [pendingCount], admins, schedules, recentAttendance, plans] = await Promise.all([
    db.select({ value: count() }).from(employees).where(eq(employees.companyId, company.id)),
    db.select({ value: count() }).from(employees).where(and(eq(employees.companyId, company.id), eq(employees.status, "active"))),
    db.select({ value: count() }).from(companyMembers).where(eq(companyMembers.companyId, company.id)),
    db.select({ value: count() }).from(attendances).where(and(eq(attendances.companyId, company.id), gte(attendances.attendanceDate, monthStartDate))),
    db.select({ value: count() }).from(leaveRequests).where(and(eq(leaveRequests.companyId, company.id), eq(leaveRequests.status, "pending"))),
    db.select({ name: user.name, email: user.email, role: companyMembers.role }).from(companyMembers).innerJoin(user, eq(companyMembers.userId, user.id)).where(and(eq(companyMembers.companyId, company.id), inArray(companyMembers.role, ["owner", "admin"]))),
    db.select().from(workSchedules).where(eq(workSchedules.companyId, company.id)),
    db.select({ id: attendances.id, name: employees.name, date: attendances.attendanceDate, status: attendances.status, checkIn: attendances.checkIn }).from(attendances).innerJoin(employees, eq(attendances.employeeId, employees.id)).where(eq(attendances.companyId, company.id)).orderBy(desc(attendances.createdAt)).limit(6),
    db.select({ id: subscriptionPlans.id, code: subscriptionPlans.code, name: subscriptionPlans.name, active: subscriptionPlans.active }).from(subscriptionPlans).orderBy(subscriptionPlans.monthlyPrice),
  ]);
  return <><header className="product-page-header"><div><span className="breadcrumb">SUPER ADMIN / DETAIL TENANT</span><h1>{company.name}</h1><p>Informasi tenant dan penggunaan aktual.</p></div><form action={enterCompany}><input type="hidden" name="companyId" value={company.id} /><button className="btn btn-primary" type="submit">Masuk sebagai Admin</button></form></header>
    <section className="stats-grid"><Stat icon={<Users size={19} />} label="Total karyawan" value={Number(employeeCount.value)} tone="blue" /><Stat icon={<Activity size={19} />} label="Karyawan aktif" value={Number(activeCount.value)} tone="green" /><Stat icon={<ShieldCheck size={19} />} label="Membership" value={Number(memberCount.value)} tone="purple" /><Stat icon={<Building2 size={19} />} label="Presensi bulan ini" value={Number(attendanceCount.value)} tone="orange" /></section>
    <section className="detail-layout"><div className="detail-main"><section className="module-card detail-section"><div className="detail-section-head"><div><Building2 size={18} /><h2>Informasi Perusahaan</h2></div><span>AKTIF</span></div><div className="detail-grid"><Info label="Nama" value={company.name} /><Info label="Industri" value={company.industry} /><Info label="Paket" value={company.plan} /><Info label="Zona waktu" value={company.timezone} /><Info label="Terdaftar" value={formatDate(company.createdAt)} /><Info label="Jadwal kerja" value={`${schedules.length} jadwal`} /></div></section>
      <section className="module-card"><div className="card-heading-row"><div><span className="eyebrow">AKTIVITAS</span><h2>Presensi terbaru</h2></div></div>{recentAttendance.length ? <div className="table-scroll"><table className="data-table"><thead><tr><th>Karyawan</th><th>Tanggal</th><th>Masuk</th><th>Status</th></tr></thead><tbody>{recentAttendance.map((row) => <tr key={row.id}><td><strong>{row.name}</strong></td><td>{row.date}</td><td>{row.checkIn?.slice(0, 5) ?? "—"}</td><td>{row.status}</td></tr>)}</tbody></table></div> : <div className="empty-state">Belum ada aktivitas presensi.</div>}</section></div>
      <aside className="detail-side"><section className="module-card detail-action-card"><span className="eyebrow">LANGGANAN</span><h2>Paket {company.plan}</h2><p>{Number(pendingCount.value)} pengajuan karyawan masih menunggu keputusan.</p><form action={setCompanyPlan} className="company-plan-form"><input type="hidden" name="companyId" value={company.id} /><label className="field"><span className="field-label">Atur paket langsung</span><select className="input" name="planId" defaultValue={plans.find((plan) => plan.code === company.plan)?.id}>{plans.map((plan) => <option value={plan.id} key={plan.id}>{plan.name}{plan.active ? "" : " (nonaktif)"}</option>)}</select></label><button className="btn btn-primary btn-block" type="submit">Terapkan Paket</button></form><Link className="btn btn-outline btn-block" href="/superadmin/paket">Setup Paket & Harga</Link><Link className="btn btn-outline btn-block" href="/superadmin/perusahaan">Kembali ke Perusahaan</Link></section><section className="module-card"><div className="card-heading-row"><div><span className="eyebrow">ADMIN TENANT</span><h2>Administrator</h2></div></div>{admins.map((admin) => <div className="progress-row" key={admin.email}><div className="progress-copy"><span>{admin.name}<small style={{ display: "block" }}>{admin.email}</small></span><strong>{admin.role}</strong></div></div>)}</section></aside></section>
  </>;
}

function Stat({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number; tone: string }) { return <article className="stat-card"><span className={`stat-icon ${tone}`}>{icon}</span><div className="stat-label">{label}</div><div className="stat-value">{value}</div><div className="stat-meta">Tenant aktif</div></article>; }
function Info({ label, value }: { label: string; value: string }) { return <div className="detail-field"><small>{label}</small><strong>{value}</strong></div>; }
function formatDate(value: Date) { return new Intl.DateTimeFormat("id-ID", { dateStyle: "long", timeZone: "Asia/Makassar" }).format(value); }
