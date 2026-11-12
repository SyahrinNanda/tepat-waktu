import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { CalendarDays, ShieldCheck } from "lucide-react";
import { db } from "@/db";
import { employees, leaveRequests, user } from "@/db/schema";
import { requireCompany } from "@/lib/current-company";
import { StatusBadge } from "@/components/status-badge";
import { SubmitButton } from "@/components/submit-button";
import { reviewLeave } from "@/features/workforce/server/actions";
import { leaveDays, leaveLabel } from "@/features/leave-requests/server/schemas";

export const metadata: Metadata = { title: "Detail Izin dan Cuti" };
type Props = { params: Promise<{ id: string }> };

export default async function Page({ params }: Props) {
  const { id } = await params;
  const context = await requireCompany();
  const canReview = ["admin", "owner", "general_manager", "hrd"].includes(context.role);
  const [row] = await db.select({
    id: leaveRequests.id, type: leaveRequests.type, specialName: leaveRequests.specialLeaveName, workDays: leaveRequests.workDays, paid: leaveRequests.paid, startDate: leaveRequests.startDate, endDate: leaveRequests.endDate,
    reason: leaveRequests.reason, status: leaveRequests.status, createdAt: leaveRequests.createdAt,
    reviewedAt: leaveRequests.reviewedAt, reviewer: user.name, employeeId: employees.id, employeeUserId: employees.userId,
    name: employees.name, code: employees.employeeCode, department: employees.department, position: employees.position,
  }).from(leaveRequests).innerJoin(employees, eq(leaveRequests.employeeId, employees.id)).leftJoin(user, eq(leaveRequests.reviewedBy, user.id))
    .where(and(eq(leaveRequests.id, id), eq(leaveRequests.companyId, context.companyId), canReview ? undefined : eq(employees.userId, context.session.user.id))).limit(1);
  if (!row) notFound();
  return <>
    <div className="page-heading"><div><h1>Detail Pengajuan</h1><p>{row.name} · {leaveLabel(row.type, row.specialName)}</p></div><div className="action-row"><StatusBadge value={row.status} /><Link className="btn btn-outline" href="/dashboard/pengajuan/izin-cuti">Kembali</Link></div></div>
    <section className="detail-layout"><div className="detail-main"><section className="card section-card"><div className="card-head"><div><h2 className="card-title">Informasi permohonan</h2><p className="card-subtitle">Dibuat {formatDateTime(row.createdAt, context.timezone)}</p></div><CalendarDays size={18} /></div><div className="detail-grid"><Info label="Karyawan" value={row.name} /><Info label="Nomor induk" value={row.code} /><Info label="Jabatan / Divisi" value={`${row.position} · ${row.department}`} /><Info label="Jenis" value={leaveLabel(row.type, row.specialName)} /><Info label="Durasi" value={`${row.workDays ? `${row.workDays} hari kerja` : `${leaveDays(row.startDate, row.endDate)} hari`} · ${row.paid ? "dibayar" : "tidak dibayar"}`} /><Info label="Tanggal mulai" value={formatDate(row.startDate)} /><Info label="Tanggal selesai" value={formatDate(row.endDate)} /></div><div className="invoice-note"><CalendarDays size={17} /><span><strong>Alasan pengajuan</strong><small>{row.reason}</small></span></div></section></div>
      <aside className="detail-side"><section className="card section-card"><div className="card-head"><div><h2 className="card-title">Keputusan</h2><p className="card-subtitle">{row.reviewer ? `Diproses oleh ${row.reviewer}` : "Belum ditinjau"}</p></div><ShieldCheck size={18} /></div>{row.reviewedAt ? <p className="card-subtitle">{formatDateTime(row.reviewedAt, context.timezone)}</p> : null}{canReview && row.status === "pending" ? <div className="action-row"><Review id={row.id} status="approved" label="Setujui" /><Review id={row.id} status="rejected" label="Tolak" danger /></div> : null}</section></aside>
    </section>
  </>;
}

function Review({ id, status, label, danger = false }: { id: string; status: "approved" | "rejected"; label: string; danger?: boolean }) { return <form action={reviewLeave}><input type="hidden" name="id" value={id} /><input type="hidden" name="status" value={status} /><SubmitButton className={`btn ${danger ? "btn-danger" : "btn-primary"}`} pendingLabel="Memproses...">{label}</SubmitButton></form>; }
function Info({ label, value }: { label: string; value: string }) { return <div className="detail-field"><small>{label}</small><strong>{value}</strong></div>; }
function formatDate(value: string) { return new Intl.DateTimeFormat("id-ID", { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`)); }
function formatDateTime(value: Date, timeZone: string) { return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone }).format(value); }
