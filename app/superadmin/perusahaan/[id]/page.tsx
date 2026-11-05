import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, count, desc, eq, gte, inArray, isNull, or } from "drizzle-orm";
import { Activity, ArrowLeft, ArrowRight, Building2, CalendarCheck2, Clock3, LogIn, ShieldCheck, Tags, Users } from "lucide-react";
import { db } from "@/db";
import { StatusBadge } from "@/components/status-badge";
import { attendances, companies, companyMembers, employees, leaveRequests, subscriptionPlans, user, workSchedules } from "@/db/schema";
import { enterCompany } from "../../actions";
import { setCompanyPlan } from "../actions";
import { CompanyDatesForm } from "@/features/subscriptions/components/company-dates-form";
import { getSubscriptionStatus } from "@/features/subscriptions/server/subscription-status";

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
    db.select({ id: subscriptionPlans.id, code: subscriptionPlans.code, name: subscriptionPlans.name, active: subscriptionPlans.active }).from(subscriptionPlans).where(or(isNull(subscriptionPlans.companyId), eq(subscriptionPlans.companyId, id))).orderBy(subscriptionPlans.monthlyPrice),
  ]);
  const planName = plans.find((plan) => plan.code === company.plan)?.name ?? company.plan;
  const subscription = await getSubscriptionStatus(company.id);
  const witaParts = (value: Date) => new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Makassar", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(value).replace(" ", "T");
  const dueLabel = subscription.endsAt ? new Intl.DateTimeFormat("id-ID", { dateStyle: "long", timeStyle: "short", timeZone: "Asia/Makassar" }).format(new Date(subscription.endsAt)) : subscription.state === "active" ? "Tanpa batas" : "—";
  const statusPill = subscription.state === "expired" ? { tone: "red", label: "Terkunci" } : subscription.state === "untracked" ? { tone: "gray", label: "Tanpa data langganan" } : subscription.warning ? { tone: "orange", label: `Habis ${subscription.daysLeft} hari lagi` } : { tone: "green", label: "Aktif" };
  const total = Number(employeeCount.value), active = Number(activeCount.value);
  const monthLabel = new Intl.DateTimeFormat("id-ID", { month: "long", timeZone: company.timezone }).format(new Date());
  const initials = company.name.split(" ").map((word) => word[0]).join("").slice(0, 2).toUpperCase();
  return <><header className="tenant-hero"><div className="tenant-hero-main"><span className="tenant-avatar">{initials}</span><div><span className="breadcrumb">Super Admin / Detail Tenant</span><h1>{company.name}</h1><div className="tenant-chips"><span className={`status-pill ${statusPill.tone}`}><i />{statusPill.label}</span><span className="tenant-chip"><Tags size={13} />Paket {planName}</span><span className="tenant-chip"><Building2 size={13} />{company.industry}</span><span className="tenant-chip"><Clock3 size={13} />{company.timezone}</span></div></div></div><div className="tenant-hero-actions"><Link className="btn btn-outline btn-compact" href="/superadmin/perusahaan"><ArrowLeft size={15} /> Kembali</Link><form action={enterCompany}><input type="hidden" name="companyId" value={company.id} /><button className="btn btn-primary btn-compact" type="submit"><LogIn size={15} /> Masuk sebagai Admin</button></form></div></header>
    <section className="stats-grid"><Stat icon={<Users size={19} />} label="Total karyawan" value={total} meta="Terdaftar di tenant" tone="blue" /><Stat icon={<Activity size={19} />} label="Karyawan aktif" value={active} meta={total ? `${Math.round(active / total * 100)}% dari total` : "Belum ada karyawan"} tone="green" /><Stat icon={<ShieldCheck size={19} />} label="Akun login" value={Number(memberCount.value)} meta="Anggota perusahaan" tone="purple" /><Stat icon={<CalendarCheck2 size={19} />} label="Presensi bulan ini" value={Number(attendanceCount.value)} meta={`Sejak 1 ${monthLabel}`} tone="orange" /></section>
    <section className="detail-layout"><div className="detail-main"><section className="module-card detail-section"><div className="detail-section-head"><div><Building2 size={18} /><h2>Informasi Perusahaan</h2></div></div><div className="detail-grid"><Info label="Nama" value={company.name} /><Info label="Industri" value={company.industry} /><Info label="Paket" value={planName} /><Info label="Zona waktu" value={company.timezone} /><Info label="Terdaftar" value={formatDate(company.createdAt)} /><Info label="Jatuh tempo langganan" value={dueLabel} /><Info label="Jadwal kerja" value={`${schedules.length} jadwal`} /></div></section>
      <section className="module-card"><div className="card-heading-row"><div><span className="eyebrow">Aktivitas</span><h2>Presensi terbaru</h2></div></div>{recentAttendance.length ? <div className="table-scroll"><table className="data-table"><thead><tr><th>Karyawan</th><th>Tanggal</th><th>Masuk</th><th>Status</th></tr></thead><tbody>{recentAttendance.map((row) => <tr key={row.id}><td><strong>{row.name}</strong></td><td>{formatDay(row.date)}</td><td>{row.checkIn?.slice(0, 5) ?? "—"}</td><td><StatusBadge value={row.status} /></td></tr>)}</tbody></table></div> : <div className="empty-state tenant-empty"><CalendarCheck2 size={28} /><strong>Belum ada aktivitas presensi</strong><span>Presensi karyawan tenant ini akan muncul di sini.</span></div>}</section></div>
      <aside className="detail-side"><section className="module-card detail-action-card tenant-plan-card"><span className="eyebrow">Langganan</span><h2>Paket {planName}</h2><p>{Number(pendingCount.value)} pengajuan karyawan masih menunggu keputusan.</p><form action={setCompanyPlan} className="company-plan-form"><input type="hidden" name="companyId" value={company.id} /><label className="field"><span className="field-label">Atur paket langsung</span><select className="input" name="planId" defaultValue={plans.find((plan) => plan.code === company.plan)?.id}>{plans.map((plan) => <option value={plan.id} key={plan.id}>{plan.name}{plan.active ? "" : " (nonaktif)"}</option>)}</select></label><label className="field"><span className="field-label">Masa aktif</span><select className="input" name="grantMonths" defaultValue="0"><option value="0">Hanya ganti paket (masa aktif tetap)</option><option value="1">Aktifkan 1 bulan (gratis)</option><option value="3">Aktifkan 3 bulan (gratis)</option><option value="6">Aktifkan 6 bulan (gratis)</option><option value="12">Aktifkan 12 bulan (gratis)</option></select></label><button className="btn btn-primary btn-block" type="submit">Terapkan Paket</button></form><Link className="tenant-link" href="/superadmin/paket"><Tags size={15} /> Setup Paket & Harga <ArrowRight size={14} /></Link></section>
        <CompanyDatesForm key={`${company.createdAt.toISOString()}-${subscription.endsAt ?? ""}`} companyId={company.id} registeredAt={witaParts(company.createdAt).slice(0, 10)} dueAt={subscription.endsAt ? witaParts(new Date(subscription.endsAt)) : ""} hasRunningOrder={Boolean(subscription.orderId)} planName={planName} />
        <section className="module-card"><div className="card-heading-row"><div><span className="eyebrow">Admin tenant</span><h2>Administrator</h2></div></div>{admins.length ? <ul className="tenant-admin-list">{admins.map((admin) => <li key={admin.email}><span className="avatar">{admin.name.slice(0, 2).toUpperCase()}</span><span><strong>{admin.name}</strong><small>{admin.email}</small></span><em>{admin.role === "owner" ? "Owner" : "Admin"}</em></li>)}</ul> : <div className="empty-state">Belum ada administrator.</div>}</section></aside></section>
  </>;
}

function Stat({ icon, label, value, meta, tone }: { icon: React.ReactNode; label: string; value: number; meta: string; tone: string }) { return <article className="stat-card"><span className={`stat-icon ${tone}`}>{icon}</span><div className="stat-label">{label}</div><div className="stat-value">{value}</div><div className="stat-meta">{meta}</div></article>; }
function Info({ label, value }: { label: string; value: string }) { return <div className="detail-field"><small>{label}</small><strong>{value}</strong></div>; }
function formatDate(value: Date) { return new Intl.DateTimeFormat("id-ID", { dateStyle: "long", timeZone: "Asia/Makassar" }).format(value); }
function formatDay(value: string) { return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`)); }
