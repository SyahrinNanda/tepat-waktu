import type { Metadata } from "next";
import { employeeLocationNames } from "@/features/employees/server/employee-locations";
import Image from "next/image";
import { notFound } from "next/navigation";
import { and, asc, eq, gte, lte } from "drizzle-orm";
import { UserRound } from "lucide-react";
import { db } from "@/db";
import { attendances, employeeDocuments, employees, leaveRequests, overtimeRequests, user } from "@/db/schema";
import { requireCompanyRole } from "@/lib/current-company";
import { employeeAccountStatuses } from "@/features/invitations/server/employee-account";
import { employeeAccountMessage } from "@/features/invitations/account-messages";
import { EmployeeAccountCard } from "@/features/invitations/components/employee-account-card";

export const metadata: Metadata = { title: "Detail Karyawan" };
const months = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ month?: string; year?: string; akun?: string }> }) {
  const { id } = await params; const query = await searchParams;
  const context = await requireCompanyRole(["admin", "general_manager", "hrd", "manager"]);
  const now = new Date(); const month = Math.min(12, Math.max(1, Number(query.month) || now.getMonth() + 1)); const year = Math.min(2100, Math.max(2000, Number(query.year) || now.getFullYear()));
  const from = `${year}-${String(month).padStart(2, "0")}-01`; const to = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
  const [[employee], documentRows, attendanceRows, leaveRows, overtimeRows] = await Promise.all([
    db.select().from(employees).where(and(eq(employees.id, id), eq(employees.companyId, context.companyId))).limit(1),
    db.select({ kind: employeeDocuments.kind, assetId: employeeDocuments.assetId }).from(employeeDocuments).where(eq(employeeDocuments.employeeId, id)),
    db.select().from(attendances).where(and(eq(attendances.companyId, context.companyId), eq(attendances.employeeId, id), gte(attendances.attendanceDate, from), lte(attendances.attendanceDate, to))).orderBy(asc(attendances.attendanceDate)),
    db.select().from(leaveRequests).where(and(eq(leaveRequests.companyId, context.companyId), eq(leaveRequests.employeeId, id))),
    db.select().from(overtimeRequests).where(and(eq(overtimeRequests.companyId, context.companyId), eq(overtimeRequests.employeeId, id))),
  ]);
  if (!employee) notFound();
  const accountStatus = (await employeeAccountStatuses(context.companyId, [employee])).get(employee.id) ?? "none";
  const [loginAccount] = employee.userId ? await db.select({ email: user.email }).from(user).where(eq(user.id, employee.userId)).limit(1) : [];
  const canManage = ["admin", "general_manager", "hrd"].includes(context.role);
  const documents = Object.fromEntries(documentRows.map((row) => [row.kind, row.assetId])) as Record<string, string>;
  const present = attendanceRows.filter((row) => row.status === "present").length;
  const late = attendanceRows.filter((row) => row.status === "late").length;
  const leave = attendanceRows.filter((row) => row.status === "leave").length;
  const absent = attendanceRows.filter((row) => row.status === "absent").length;
  const workedMinutes = attendanceRows.reduce((total, row) => total + duration(row.checkIn, row.checkOut), 0);
  const locationNames = employee.allAttendanceLocations ? [] : await employeeLocationNames(employee.id);
  return <>
    <div className="master-page-head"><span>Kehadiran Admin Panel</span><h1>DETAIL KARYAWAN</h1><p>Beranda / Karyawan / Detail Karyawan</p></div>
    <EmployeeAccountCard employeeId={employee.id} status={accountStatus} loginEmail={loginAccount?.email ?? null} employeeEmail={employee.email} canManage={canManage}
      initialNotice={employeeAccountMessage(query.akun, loginAccount?.email ?? employee.email)} />
    <section className="employee-detail-profile">
      <div className="employee-detail-avatar">{documents.profile_photo ? <Image src={`/api/files/${documents.profile_photo}`} alt={employee.name} width={100} height={100} unoptimized/> : <UserRound size={72}/>}</div>
      <div className="employee-detail-copy"><h2>{employee.name.toUpperCase()}</h2><div className="employee-detail-grid">
        <Info label="Nomor Induk" value={employee.employeeCode}/><Info label="Jenis Kelamin" value={gender(employee.gender)}/>
        <Info label="Jabatan" value={employee.position}/><Info label="No. Handphone" value={employee.phone}/>
        <Info label="Divisi" value={employee.department}/><Info label="Lokasi Kerja" value={employee.allAttendanceLocations ? "Semua Lokasi Perusahaan" : locationNames.length ? locationNames.join(", ") : "Lokasi Tertentu"}/>
        <Info label="Email" value={employee.email}/><Info label="Alamat" value={employee.address}/>
        <Info label="Tanggal Lahir" value={employee.birthDate}/><Info label="Foto Selfie" value={documents.selfie ? "Lihat foto" : "–"} href={documents.selfie ? `/api/files/${documents.selfie}` : undefined}/>
        <Info label="Tgl Karyawan Bergabung" value={employee.joinedAt}/><Info label="Foto KTP" value={documents.identity_card ? "Lihat dokumen" : "–"} href={documents.identity_card ? `/api/files/${documents.identity_card}` : undefined}/>
        <Info label="Foto Ijazah" value={documents.certificate ? "Lihat dokumen" : "–"} href={documents.certificate ? `/api/files/${documents.certificate}` : undefined}/>
      </div></div>
    </section>
    <section className="employee-detail-tabs-card">
      <nav className="employee-detail-tabs"><span>Kehadiran</span><button>Absen Kunjungan</button><button>Kontrak Kerja</button><button>Daftar Lembur ({overtimeRows.length})</button><button>Daftar Inventaris</button><button>Daftar Device</button></nav>
      <h3>Laporan Kehadiran Karyawan</h3>
      <form className="employee-report-filters"><label>Filter Bulan<select name="month" defaultValue={month}>{months.map((name, index) => <option key={name} value={index + 1}>{name}</option>)}</select></label><label>Filter Tahun<select name="year" defaultValue={year}>{[year - 1, year, year + 1].map((item) => <option key={item}>{item}</option>)}</select></label><button className="btn btn-outline" type="submit">Tampilkan</button></form>
      <div className="employee-report-summary"><Info label="Jumlah Hari" value={`${new Date(Date.UTC(year, month, 0)).getUTCDate()} Hari`}/><Info label="Jumlah Kehadiran" value={`${attendanceRows.length} Hari`}/><Info label="Jumlah Berangkat Tepat Waktu" value={`${present} Hari`}/><Info label="Jumlah Terlambat" value={`${late} Hari`}/><Info label="Jumlah Izin/Cuti/Sakit" value={`${leaveRows.length + leave} Hari`}/><Info label="Jumlah Lembur" value={`${overtimeRows.length} Hari`}/><Info label="Jumlah Jam Kerja Aktual" value={`${workedMinutes} Menit`}/><Info label="Jumlah Alpa" value={`${absent} Hari`}/></div>
      <div className="employee-attendance-table">{attendanceRows.length ? <table><thead><tr><th>Tanggal</th><th>Jam Masuk</th><th>Jam Pulang</th><th>Status</th></tr></thead><tbody>{attendanceRows.map((row) => <tr key={row.id}><td>{row.attendanceDate}</td><td>{row.checkIn?.slice(0, 5) ?? "–"}</td><td>{row.checkOut?.slice(0, 5) ?? "–"}</td><td>{row.status}</td></tr>)}</tbody></table> : <div className="location-empty"><strong>Data Kosong</strong><span>Belum ada kehadiran pada periode ini.</span></div>}</div>
    </section>
  </>;
}

function Info({ label, value, href }: { label: string; value?: string | null; href?: string }) { return <div className="employee-info"><span>{label}</span><b>:</b>{href ? <a href={href} target="_blank" rel="noreferrer">{value}</a> : <strong>{value || "–"}</strong>}</div>; }
function gender(value: string) { return value === "male" ? "Laki-laki" : value === "female" ? "Perempuan" : "Belum ditentukan"; }
function duration(start: string | null, end: string | null) { if (!start || !end) return 0; const [sh, sm] = start.split(":").map(Number); const [eh, em] = end.split(":").map(Number); return Math.max(0, eh * 60 + em - sh * 60 - sm); }
