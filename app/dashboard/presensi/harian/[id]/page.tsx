import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { Camera, Clock3, MapPin, ShieldCheck } from "lucide-react";
import { db } from "@/db";
import { attendanceEvents, attendances, employees, user } from "@/db/schema";
import { requireCompanyRole } from "@/lib/current-company";
import { StatusBadge } from "@/components/status-badge";

export const metadata: Metadata = { title: "Detail Kehadiran" };
type Props = { params: Promise<{ id: string }> };

export default async function Page({ params }: Props) {
  const { id } = await params;
  const context = await requireCompanyRole(["admin", "general_manager", "hrd", "manager"]);
  const [record] = await db.select({
    id: attendances.id, date: attendances.attendanceDate, checkIn: attendances.checkIn, checkOut: attendances.checkOut,
    status: attendances.status, note: attendances.note, employeeId: employees.id, name: employees.name,
    code: employees.employeeCode, department: employees.department, position: employees.position,
  }).from(attendances).innerJoin(employees, eq(attendances.employeeId, employees.id))
    .where(and(eq(attendances.id, id), eq(attendances.companyId, context.companyId))).limit(1);
  if (!record) notFound();
  const events = await db.select({
    id: attendanceEvents.id, type: attendanceEvents.type, source: attendanceEvents.source,
    occurredAt: attendanceEvents.occurredAt, clientCapturedAt: attendanceEvents.clientCapturedAt,
    latitude: attendanceEvents.latitude, longitude: attendanceEvents.longitude, accuracy: attendanceEvents.accuracyMeters,
    ipAddress: attendanceEvents.ipAddress, note: attendanceEvents.note, photoAssetId: attendanceEvents.photoAssetId,
    actorName: user.name,
  }).from(attendanceEvents).innerJoin(user, eq(attendanceEvents.recordedBy, user.id))
    .where(and(eq(attendanceEvents.attendanceId, record.id), eq(attendanceEvents.companyId, context.companyId)))
    .orderBy(asc(attendanceEvents.occurredAt));
  return <>
    <div className="page-heading"><div><h1>Detail Kehadiran</h1><p>{record.name} · {formatDate(record.date)}</p></div><div className="action-row"><StatusBadge value={record.status} /><Link className="btn btn-outline" href={`/dashboard/presensi/harian?date=${record.date}`}>Kembali</Link></div></div>
    <section className="detail-layout"><div className="detail-main">
      <section className="card section-card"><div className="card-head"><div><h2 className="card-title">Ringkasan</h2><p className="card-subtitle">Sumber data dari record kehadiran tersimpan.</p></div><Clock3 size={18} /></div><div className="detail-grid">
        <Info label="Karyawan" value={record.name} /><Info label="Nomor induk" value={record.code} /><Info label="Jabatan" value={record.position} /><Info label="Divisi" value={record.department} /><Info label="Jam masuk" value={record.checkIn?.slice(0, 5) ?? "—"} /><Info label="Jam pulang" value={record.checkOut?.slice(0, 5) ?? "—"} />
      </div>{record.note ? <div className="invoice-note"><ShieldCheck size={17} /><span><strong>Catatan</strong><small>{record.note}</small></span></div> : null}</section>
      <section className="card"><div className="card-head"><div><h2 className="card-title">Jejak check-in/check-out</h2><p className="card-subtitle">Waktu, lokasi, sumber, dan pelaku dicatat untuk audit.</p></div></div>{events.length ? <div className="table-wrap"><table className="table"><thead><tr><th>Aksi</th><th>Waktu server</th><th>Sumber</th><th>Lokasi</th><th>Pelaku</th><th>Bukti</th></tr></thead><tbody>{events.map((event) => <tr key={event.id}><td><StatusBadge value={event.type} /></td><td>{formatDateTime(event.occurredAt, context.timezone)}</td><td>{sourceLabel(event.source)}</td><td>{event.latitude != null && event.longitude != null ? <span>{event.latitude.toFixed(5)}, {event.longitude.toFixed(5)}<small style={{ display: "block" }}>akurasi {Math.round(event.accuracy ?? 0)} m</small></span> : "—"}</td><td>{event.actorName}</td><td>{event.photoAssetId ? <Link className="btn btn-sm btn-outline" href={`/api/files/${event.photoAssetId}`} target="_blank"><Camera size={14} /> Lihat foto</Link> : "Tanpa foto"}</td></tr>)}</tbody></table></div> : <div className="empty-state"><MapPin size={28} /><strong>Jejak lama</strong><span>Record ini dibuat sebelum audit event diaktifkan.</span></div>}</section>
    </div><aside className="detail-side"><section className="card section-card"><div className="card-head"><div><h2 className="card-title">Keamanan bukti</h2></div><ShieldCheck size={18} /></div><p className="card-subtitle">Foto tidak memakai URL publik. Endpoint file memeriksa session dan tenant pada setiap permintaan.</p></section></aside></section>
  </>;
}

function Info({ label, value }: { label: string; value: string }) { return <div className="detail-field"><small>{label}</small><strong>{value}</strong></div>; }
function sourceLabel(value: string) { return ({ self: "Mandiri", admin: "Admin", superadmin: "Super Admin" } as Record<string, string>)[value] ?? value; }
function formatDate(value: string) { return new Intl.DateTimeFormat("id-ID", { dateStyle: "full", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`)); }
function formatDateTime(value: Date, timeZone: string) { return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone }).format(value); }
