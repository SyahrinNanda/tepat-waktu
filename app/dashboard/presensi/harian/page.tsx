import type { Metadata } from "next";
import { and, asc, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import {
  attendanceEvents,
  attendanceLocations,
  attendances,
  divisions,
  employees,
  workSchedules,
} from "@/db/schema";
import { dateInTimeZone, requireCompanyRole } from "@/lib/current-company";
import {
  DailyAttendanceManager,
  DailyAttendanceRecord,
} from "@/features/attendance/components/daily-attendance-manager";

export const metadata: Metadata = {
  title: "Presensi Harian | TepatWaktu",
  description: "Kelola catatan presensi harian karyawan secara lengkap dan akurat.",
};

type Props = {
  searchParams: Promise<{ date?: string; q?: string }>;
};

export default async function Page({ searchParams }: Props) {
  const context = await requireCompanyRole(["admin", "general_manager", "hrd", "manager"]);
  const params = await searchParams;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(params.date ?? "")
    ? params.date!
    : dateInTimeZone(context.timezone);

  const checkInLocation = alias(attendanceLocations, "check_in_loc");
  const checkOutLocation = alias(attendanceLocations, "check_out_loc");

  const [
    employeesList,
    shiftsList,
    locationsList,
    divisionsList,
    rawAttendances,
    eventsList,
  ] = await Promise.all([
    // 1. Active employees
    db
      .select({
        id: employees.id,
        name: employees.name,
        employeeCode: employees.employeeCode,
        department: employees.department,
        position: employees.position,
      })
      .from(employees)
      .where(and(eq(employees.companyId, context.companyId), eq(employees.status, "active")))
      .orderBy(asc(employees.name)),

    // 2. Shifts / Work schedules
    db
      .select({
        id: workSchedules.id,
        name: workSchedules.name,
        startTime: workSchedules.startTime,
        endTime: workSchedules.endTime,
      })
      .from(workSchedules)
      .where(eq(workSchedules.companyId, context.companyId))
      .orderBy(asc(workSchedules.name)),

    // 3. Attendance locations
    db
      .select({
        id: attendanceLocations.id,
        name: attendanceLocations.name,
      })
      .from(attendanceLocations)
      .where(eq(attendanceLocations.companyId, context.companyId))
      .orderBy(asc(attendanceLocations.name)),

    // 4. Divisions
    db
      .select({
        id: divisions.id,
        name: divisions.name,
      })
      .from(divisions)
      .where(eq(divisions.companyId, context.companyId))
      .orderBy(asc(divisions.name)),

    // 5. Daily Attendances with joined shifts & locations
    db
      .select({
        id: attendances.id,
        employeeId: attendances.employeeId,
        employeeName: employees.name,
        employeeCode: employees.employeeCode,
        department: employees.department,
        shiftId: attendances.shiftId,
        shiftName: workSchedules.name,
        shiftStartTime: workSchedules.startTime,
        shiftEndTime: workSchedules.endTime,
        checkIn: attendances.checkIn,
        checkInLocationId: attendances.checkInLocationId,
        checkInLocationName: checkInLocation.name,
        checkOut: attendances.checkOut,
        checkOutLocationId: attendances.checkOutLocationId,
        checkOutLocationName: checkOutLocation.name,
        breakStart: attendances.breakStart,
        breakEnd: attendances.breakEnd,
        status: attendances.status,
        note: attendances.note,
      })
      .from(attendances)
      .innerJoin(employees, eq(attendances.employeeId, employees.id))
      .leftJoin(workSchedules, eq(attendances.shiftId, workSchedules.id))
      .leftJoin(checkInLocation, eq(attendances.checkInLocationId, checkInLocation.id))
      .leftJoin(checkOutLocation, eq(attendances.checkOutLocationId, checkOutLocation.id))
      .where(and(eq(attendances.companyId, context.companyId), eq(attendances.attendanceDate, date)))
      .orderBy(asc(employees.name)),

    // 6. Audit events with photos for the date
    db
      .select({
        attendanceId: attendanceEvents.attendanceId,
        type: attendanceEvents.type,
        photoAssetId: attendanceEvents.photoAssetId,
      })
      .from(attendanceEvents)
      .where(eq(attendanceEvents.companyId, context.companyId)),
  ]);

  // Map photo assets from events to attendances
  const photoMap = new Map<string, { checkInPhoto: string | null; checkOutPhoto: string | null }>();
  for (const ev of eventsList) {
    if (!photoMap.has(ev.attendanceId)) {
      photoMap.set(ev.attendanceId, { checkInPhoto: null, checkOutPhoto: null });
    }
    const current = photoMap.get(ev.attendanceId)!;
    if (ev.type === "check_in" && ev.photoAssetId) {
      current.checkInPhoto = ev.photoAssetId;
    } else if (ev.type === "check_out" && ev.photoAssetId) {
      current.checkOutPhoto = ev.photoAssetId;
    }
  }

  // Format attendance records
  const formattedRecords: DailyAttendanceRecord[] = rawAttendances.map((rec) => {
    const photos = photoMap.get(rec.id);
    const shiftHours =
      rec.shiftStartTime && rec.shiftEndTime
        ? `${rec.shiftStartTime.slice(0, 5)} - ${rec.shiftEndTime.slice(0, 5)}`
        : null;

    return {
      id: rec.id,
      employeeId: rec.employeeId,
      employeeName: rec.employeeName,
      employeeCode: rec.employeeCode,
      department: rec.department,
      shiftId: rec.shiftId,
      shiftName: rec.shiftName,
      shiftHours,
      checkIn: rec.checkIn,
      checkInLocationId: rec.checkInLocationId,
      checkInLocationName: rec.checkInLocationName,
      checkInPhotoAssetId: photos?.checkInPhoto ?? null,
      checkOut: rec.checkOut,
      checkOutLocationId: rec.checkOutLocationId,
      checkOutLocationName: rec.checkOutLocationName,
      checkOutPhotoAssetId: photos?.checkOutPhoto ?? null,
      breakStart: rec.breakStart,
      breakEnd: rec.breakEnd,
      status: rec.status,
      note: rec.note,
    };
  });

  return (
    <DailyAttendanceManager
      initialDate={date}
      employees={employeesList}
      shifts={shiftsList}
      locations={locationsList}
      divisions={divisionsList}
      records={formattedRecords}
    />
  );
}
