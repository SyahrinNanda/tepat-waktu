import type { Metadata } from "next";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { attendanceLocations, divisions, workSchedules } from "@/db/schema";
import { dateInTimeZone, requireCompanyRole } from "@/lib/current-company";
import { MonthlyAttendanceManager } from "@/features/attendance/components/monthly-attendance-manager";
import { fetchMonthlyAttendanceSummary } from "@/features/attendance/server/monthly-service";

export const metadata: Metadata = { title: "Laporan Presensi Bulanan" };

type Props = {
  searchParams: Promise<{
    month?: string;
    year?: string;
    q?: string;
    locationId?: string;
    division?: string;
    shiftId?: string;
  }>;
};

export default async function Page({ searchParams }: Props) {
  const context = await requireCompanyRole(["admin", "general_manager", "hrd", "manager"]);
  const params = await searchParams;
  const today = dateInTimeZone(context.timezone);
  const currentYear = Number(today.slice(0, 4));
  const currentMonth = Number(today.slice(5, 7));
  const year = clamp(Number(params.year) || currentYear, 2020, 2100);
  const month = clamp(Number(params.month) || currentMonth, 1, 12);
  const query = params.q?.trim() || undefined;
  const locationId = params.locationId?.trim() || undefined;
  const division = params.division?.trim() || undefined;
  const shiftId = params.shiftId?.trim() || undefined;

  const [locRows, divRows, shiftRows, summaries] = await Promise.all([
    db
      .select({ id: attendanceLocations.id, name: attendanceLocations.name })
      .from(attendanceLocations)
      .where(and(eq(attendanceLocations.companyId, context.companyId), eq(attendanceLocations.active, true)))
      .orderBy(asc(attendanceLocations.name)),
    db
      .select({ id: divisions.id, name: divisions.name })
      .from(divisions)
      .where(and(eq(divisions.companyId, context.companyId), eq(divisions.active, true)))
      .orderBy(asc(divisions.name)),
    db
      .select({
        id: workSchedules.id,
        name: workSchedules.name,
        startTime: workSchedules.startTime,
        endTime: workSchedules.endTime,
      })
      .from(workSchedules)
      .where(and(eq(workSchedules.companyId, context.companyId), eq(workSchedules.active, true)))
      .orderBy(asc(workSchedules.name)),
    fetchMonthlyAttendanceSummary({
      companyId: context.companyId,
      year,
      month,
      query,
      locationId,
      division,
      shiftId,
    }),
  ]);

  return (
    <MonthlyAttendanceManager
      initialYear={year}
      initialMonth={month}
      initialQuery={query}
      initialLocationId={locationId}
      initialDivision={division}
      initialShiftId={shiftId}
      locations={locRows}
      divisions={divRows}
      shifts={shiftRows}
      summaries={summaries}
    />
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
