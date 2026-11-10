import type { Metadata } from "next";
import Link from "next/link";
import { and, asc, desc, eq, gte, inArray, lte } from "drizzle-orm";
import { CalendarDays, Camera, CheckCircle2, Clock3, History, LogIn, LogOut, TimerOff } from "lucide-react";
import { db } from "@/db";
import { attendanceEvents, attendances, employees, workSchedules } from "@/db/schema";
import { StatusBadge } from "@/components/status-badge";
import { AttendanceEmployeeFilter, type AttendanceEmployeeOption } from "@/features/attendance/components/attendance-employee-filter";
import { requireCompany } from "@/lib/current-company";

export const metadata: Metadata = { title: "Riwayat" };

type PageProps = {
  searchParams: Promise<{ month?: string; year?: string; employeeId?: string }>;
};

const monthNames = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

export default async function Page({ searchParams }: PageProps) {
  const context = await requireCompany();
  const params = await searchParams;
  const canSelectEmployee = ["admin", "owner"].includes(context.role) || context.isSuperAdmin;
  const now = new Date();
  const selectedYear = safeInteger(params.year, now.getFullYear(), 2020, now.getFullYear() + 1);
  const selectedMonth = safeInteger(params.month, now.getMonth() + 1, 1, 12);
  const from = `${selectedYear}-${String(selectedMonth).padStart(2, "0")}-01`;
  const lastDay = new Date(Date.UTC(selectedYear, selectedMonth, 0)).getUTCDate();
  const until = `${selectedYear}-${String(selectedMonth).padStart(2, "0")}-${lastDay}`;

  const employeeOptions: AttendanceEmployeeOption[] = canSelectEmployee ? await db.select({
    id: employees.id,
    name: employees.name,
    employeeCode: employees.employeeCode,
    department: employees.department,
  }).from(employees).where(and(eq(employees.companyId, context.companyId), eq(employees.status, "active"))).orderBy(asc(employees.name)) : [];

  type SelectedEmployee = { id: string; name: string; code: string; department: string; position: string };
  let employee: SelectedEmployee | undefined;
  if (canSelectEmployee) {
    const requestedEmployeeId = employeeOptions.some((item) => item.id === params.employeeId) ? params.employeeId : employeeOptions[0]?.id;
    if (requestedEmployeeId) {
      [employee] = await db.select({
        id: employees.id, name: employees.name, code: employees.employeeCode,
        department: employees.department, position: employees.position,
      }).from(employees).where(and(
        eq(employees.companyId, context.companyId),
        eq(employees.id, requestedEmployeeId),
        eq(employees.status, "active"),
      )).limit(1);
    }
  } else {
    [employee] = await db.select({
      id: employees.id,
      name: employees.name,
      code: employees.employeeCode,
      department: employees.department,
      position: employees.position,
    }).from(employees).where(and(
      eq(employees.companyId, context.companyId),
      eq(employees.userId, context.session.user.id),
      eq(employees.status, "active"),
    )).limit(1);
  }

  // Akun undangan lama dapat belum memiliki userId, meski email karyawan dan
  // identitas Better Auth sudah sama. Tautkan sekali dengan batas tenant yang
  // ketat, sama seperti alur check-in mandiri.
  if (!employee && !canSelectEmployee) {
    [employee] = await db.select({
      id: employees.id,
      name: employees.name,
      code: employees.employeeCode,
      department: employees.department,
      position: employees.position,
    }).from(employees).where(and(
      eq(employees.companyId, context.companyId),
      eq(employees.email, context.session.user.email.toLowerCase()),
      eq(employees.status, "active"),
    )).limit(1);
    if (employee) {
      await db.update(employees).set({ userId: context.session.user.id }).where(and(
        eq(employees.companyId, context.companyId),
        eq(employees.id, employee.id),
      ));
    }
  }

  if (!employee) return canSelectEmployee ? <NoActiveEmployees /> : <EmployeeNotLinked />;

  const rows = await db.select({
    id: attendances.id,
    date: attendances.attendanceDate,
    checkIn: attendances.checkIn,
    checkOut: attendances.checkOut,
    status: attendances.status,
    note: attendances.note,
    shift: workSchedules.name,
  }).from(attendances)
    .leftJoin(workSchedules, eq(attendances.shiftId, workSchedules.id))
    .where(and(
      eq(attendances.companyId, context.companyId),
      eq(attendances.employeeId, employee.id),
      gte(attendances.attendanceDate, from),
      lte(attendances.attendanceDate, until),
    ))
    .orderBy(desc(attendances.attendanceDate));

  const eventRows = rows.length ? await db.select({
    attendanceId: attendanceEvents.attendanceId,
    type: attendanceEvents.type,
    occurredAt: attendanceEvents.occurredAt,
    photoAssetId: attendanceEvents.photoAssetId,
  }).from(attendanceEvents).where(and(
    eq(attendanceEvents.companyId, context.companyId),
    eq(attendanceEvents.employeeId, employee.id),
    inArray(attendanceEvents.attendanceId, rows.map((row) => row.id)),
  )).orderBy(asc(attendanceEvents.occurredAt)) : [];

  const eventsByAttendance = new Map<string, typeof eventRows>();
  for (const event of eventRows) {
    const list = eventsByAttendance.get(event.attendanceId) ?? [];
    list.push(event);
    eventsByAttendance.set(event.attendanceId, list);
  }

  const totals = rows.reduce((result, row) => {
    result[row.status] += 1;
    if (row.checkIn && !row.checkOut) result.incomplete += 1;
    return result;
  }, { present: 0, late: 0, absent: 0, leave: 0, incomplete: 0 });

  const years = Array.from({ length: Math.max(1, now.getFullYear() - 2019) }, (_, index) => now.getFullYear() + 1 - index);

  return <>
    <header className="product-page-header attendance-history-header">
      <div>
        <span className="breadcrumb">Kehadiran / Riwayat {canSelectEmployee ? "Karyawan" : "Saya"}</span>
        <h1>{canSelectEmployee ? "Riwayat Kehadiran Karyawan" : "Riwayat Kehadiran Saya"}</h1>
        <p>{employee.name} · {employee.code} · {employee.position}, {employee.department}</p>
      </div>
      {!canSelectEmployee ? <Link className="btn btn-primary" href="/dashboard/presensi/check-in"><Camera size={16} /> Buka Kehadiran</Link> : null}
    </header>

    <section className="attendance-history-summary" aria-label="Ringkasan kehadiran">
      <Summary icon={<CalendarDays size={19} />} label="Total catatan" value={rows.length} tone="blue" />
      <Summary icon={<CheckCircle2 size={19} />} label="Tepat waktu" value={totals.present} tone="green" />
      <Summary icon={<Clock3 size={19} />} label="Terlambat" value={totals.late} tone="orange" />
      <Summary icon={<TimerOff size={19} />} label="Belum check-out" value={totals.incomplete} tone="red" />
    </section>

    <section className="module-card attendance-history-card">
      {canSelectEmployee ? <div className="attendance-history-employee-row"><AttendanceEmployeeFilter employees={employeeOptions} value={employee.id} /></div> : null}
      <form className="attendance-history-filters" method="get">
        {canSelectEmployee ? <input type="hidden" name="employeeId" value={employee.id} /> : null}
        <label><span>Bulan</span><select className="input" name="month" defaultValue={selectedMonth}>{monthNames.map((name, index) => <option value={index + 1} key={name}>{name}</option>)}</select></label>
        <label><span>Tahun</span><select className="input" name="year" defaultValue={selectedYear}>{years.map((year) => <option value={year} key={year}>{year}</option>)}</select></label>
        <button className="btn btn-primary" type="submit">Tampilkan</button>
      </form>

      {rows.length ? <div className="table-scroll"><table className="data-table attendance-history-table">
        <thead><tr><th>Tanggal</th><th>Jadwal Kerja</th><th>Check-in</th><th>Check-out</th><th>Status</th><th>Bukti Foto</th><th>Catatan</th></tr></thead>
        <tbody>{rows.map((row) => {
          const events = eventsByAttendance.get(row.id) ?? [];
          const checkInEvent = events.find((event) => event.type === "check_in");
          const checkOutEvent = events.find((event) => event.type === "check_out");
          return <tr key={row.id}>
            <td><strong>{formatDate(row.date)}</strong><small>{weekday(row.date)}</small></td>
            <td>{row.shift ?? "Jadwal perusahaan"}</td>
            <td><span className="attendance-history-time"><LogIn size={14} />{row.checkIn?.slice(0, 5) ?? "—"}</span></td>
            <td><span className="attendance-history-time"><LogOut size={14} />{row.checkOut?.slice(0, 5) ?? "—"}</span></td>
            <td><StatusBadge value={row.status} /></td>
            <td><div className="attendance-history-proof">
              {checkInEvent?.photoAssetId ? <Link href={`/api/files/${checkInEvent.photoAssetId}`} target="_blank" className="btn btn-sm btn-outline"><Camera size={13} /> Masuk</Link> : null}
              {checkOutEvent?.photoAssetId ? <Link href={`/api/files/${checkOutEvent.photoAssetId}`} target="_blank" className="btn btn-sm btn-outline"><Camera size={13} /> Pulang</Link> : null}
              {!checkInEvent?.photoAssetId && !checkOutEvent?.photoAssetId ? "—" : null}
            </div></td>
            <td className="attendance-history-note">{row.note || "—"}</td>
          </tr>;
        })}</tbody>
      </table></div> : <div className="attendance-history-empty"><History size={34} /><strong>Belum ada riwayat kehadiran</strong><span>Tidak ditemukan catatan pada {monthNames[selectedMonth - 1]} {selectedYear}.</span>{!canSelectEmployee ? <Link className="btn btn-primary" href="/dashboard/presensi/check-in">Buka halaman kehadiran</Link> : null}</div>}
      <footer className="table-footer"><span>Menampilkan {rows.length} catatan milik {employee.name}</span></footer>
    </section>
  </>;
}

function Summary({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number; tone: string }) {
  return <article className={`attendance-history-stat ${tone}`}><span>{icon}</span><div><strong>{value}</strong><small>{label}</small></div></article>;
}

function EmployeeNotLinked() {
  return <div className="module-card attendance-history-empty"><History size={34} /><strong>Data karyawan belum terhubung</strong><span>Hubungi administrator perusahaan agar akun login ditautkan ke data karyawan aktif.</span><Link className="btn btn-outline" href="/dashboard">Kembali ke dashboard</Link></div>;
}

function NoActiveEmployees() {
  return <div className="module-card attendance-history-empty"><History size={34} /><strong>Belum ada karyawan aktif</strong><span>Tambahkan atau aktifkan karyawan terlebih dahulu untuk melihat riwayat kehadirannya.</span><Link className="btn btn-outline" href="/dashboard/karyawan">Buka daftar karyawan</Link></div>;
}

function safeInteger(value: string | undefined, fallback: number, min: number, max: number) {
  const number = Number.parseInt(value ?? "", 10);
  return Number.isInteger(number) && number >= min && number <= max ? number : fallback;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
}

function weekday(value: string) {
  return new Intl.DateTimeFormat("id-ID", { weekday: "long", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
}
