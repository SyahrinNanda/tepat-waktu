import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq, gte, lte } from "drizzle-orm";
import { BarChart3 } from "lucide-react";
import { db } from "@/db";
import { attendances, employees } from "@/db/schema";
import { dateInTimeZone, requireCompanyRole } from "@/lib/current-company";
import { StatusBadge } from "@/components/status-badge";

export const metadata: Metadata = { title: "Detail Presensi Bulanan" };
type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ month?: string; year?: string }> };

export default async function Page({ params, searchParams }: Props) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const context = await requireCompanyRole(["admin", "general_manager", "hrd", "manager"]);
  const today = dateInTimeZone(context.timezone);
  const year = clamp(Number(query.year) || Number(today.slice(0, 4)), 2020, 2100);
  const month = clamp(Number(query.month) || Number(today.slice(5, 7)), 1, 12);
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const endDate = `${year}-${String(month).padStart(2, "0")}-${String(new Date(Date.UTC(year, month, 0)).getUTCDate()).padStart(2, "0")}`;
  const [employee] = await db.select().from(employees).where(and(eq(employees.id, id), eq(employees.companyId, context.companyId))).limit(1);
  if (!employee) notFound();
  const rows = await db.select().from(attendances).where(and(eq(attendances.companyId, context.companyId), eq(attendances.employeeId, employee.id), gte(attendances.attendanceDate, startDate), lte(attendances.attendanceDate, endDate))).orderBy(asc(attendances.attendanceDate));
  const counts = rows.reduce<Record<string, number>>((result, row) => { result[row.status] = (result[row.status] ?? 0) + 1; return result; }, {});
  return <>
    <div className="page-heading"><div><h1>{employee.name}</h1><p>Rekap {monthName(month)} {year} · {employee.department}</p></div><Link className="btn btn-outline" href={`/dashboard/presensi/bulanan?month=${month}&year=${year}` as Route}>Kembali</Link></div>
    <section className="stats-grid"><Stat label="Hari tercatat" value={rows.length} tone="blue" /><Stat label="Tepat waktu" value={counts.present ?? 0} tone="green" /><Stat label="Terlambat" value={counts.late ?? 0} tone="orange" /><Stat label="Cuti/Absen" value={(counts.leave ?? 0) + (counts.absent ?? 0)} tone="red" /></section>
    <section className="card"><div className="card-head"><div><h2 className="card-title">Rincian harian</h2><p className="card-subtitle">Klik record untuk melihat foto dan jejak audit.</p></div></div>{rows.length ? <div className="table-wrap"><table className="table"><thead><tr><th>Tanggal</th><th>Jam Masuk</th><th>Jam Pulang</th><th>Status</th><th>Catatan</th><th>Aksi</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td>{formatDate(row.attendanceDate)}</td><td>{row.checkIn?.slice(0, 5) ?? "—"}</td><td>{row.checkOut?.slice(0, 5) ?? "—"}</td><td><StatusBadge value={row.status} /></td><td>{row.note ?? "—"}</td><td><Link className="btn btn-sm btn-outline" href={`/dashboard/presensi/harian/${row.id}` as Route}>Detail</Link></td></tr>)}</tbody></table></div> : <div className="empty-state"><BarChart3 size={28} /><strong>Belum ada presensi</strong><span>Tidak ada pencatatan pada periode ini.</span></div>}</section>
  </>;
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) { return <article className="stat-card"><span className={`stat-icon ${tone}`}><BarChart3 size={19} /></span><div className="stat-label">{label}</div><div className="stat-value">{value}</div><div className="stat-meta">Dalam periode dipilih</div></article>; }
function clamp(value: number, min: number, max: number) { return Math.min(Math.max(value, min), max); }
function monthName(month: number) { return new Intl.DateTimeFormat("id-ID", { month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(2026, month - 1, 1))); }
function formatDate(value: string) { return new Intl.DateTimeFormat("id-ID", { weekday: "long", day: "2-digit", month: "short", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`)); }
