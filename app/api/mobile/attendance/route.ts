import { and, desc, eq, gte, lte } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { attendanceEvents, attendances, employees } from "@/db/schema";
import { AttendanceError, selfAttendanceContext } from "@/features/attendance/server/attendance-service";
import { accessScope, employeeScopeFilter } from "@/features/access/team-scope";

export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const context = await selfAttendanceContext(request);
    const params = new URL(request.url).searchParams;
    const scope = params.get("scope");
    if (scope !== "self" && context.role === "employee") return Response.json({ error: "Akses ditolak." }, { status: 403 });
    const year = params.get("year");
    const month = params.get("month");
    const day = params.get("day");
    if ((year && !/^20\d{2}$/.test(year)) || (month && (!year || !/^(0?[1-9]|1[0-2])$/.test(month))) || (day && (!month || !/^(0?[1-9]|[12]\d|3[01])$/.test(day)))) {
      return Response.json({ error: "Filter tanggal tidak valid." }, { status: 400 });
    }
    let from: string | undefined;
    let through: string | undefined;
    if (year) {
      const paddedMonth = String(Number(month || 1)).padStart(2, "0");
      const paddedDay = String(Number(day || 1)).padStart(2, "0");
      from = `${year}-${paddedMonth}-${paddedDay}`;
      through = day ? from : month ? `${year}-${paddedMonth}-${new Date(Date.UTC(Number(year), Number(month), 0)).getUTCDate()}` : `${year}-12-31`;
      if (day && new Date(`${from}T00:00:00Z`).toISOString().slice(0, 10) !== from) return Response.json({ error: "Tanggal tidak valid." }, { status: 400 });
    }
    const teamFilter = scope === "self" ? undefined : employeeScopeFilter(await accessScope(context));
    const checkInEvent = alias(attendanceEvents, "mobile_check_in_event");
    const checkOutEvent = alias(attendanceEvents, "mobile_check_out_event");
    const rows = await db.select({
      id: attendances.id, employeeId: attendances.employeeId, name: employees.name,
      attendanceDate: attendances.attendanceDate, checkIn: attendances.checkIn,
      checkOut: attendances.checkOut, status: attendances.status, note: attendances.note,
      checkInPhotoId: checkInEvent.photoAssetId, checkOutPhotoId: checkOutEvent.photoAssetId,
    }).from(attendances).innerJoin(employees, eq(attendances.employeeId, employees.id))
      .leftJoin(checkInEvent, and(eq(checkInEvent.attendanceId, attendances.id), eq(checkInEvent.type, "check_in")))
      .leftJoin(checkOutEvent, and(eq(checkOutEvent.attendanceId, attendances.id), eq(checkOutEvent.type, "check_out")))
      .where(and(eq(attendances.companyId, context.companyId), scope === "self" ? eq(attendances.employeeId, context.employeeId) : teamFilter,
        from ? gte(attendances.attendanceDate, from) : undefined, through ? lte(attendances.attendanceDate, through) : undefined))
      .orderBy(desc(attendances.attendanceDate)).limit(500);
    return Response.json({ rows });
  } catch (error) {
    if (error instanceof AttendanceError) return Response.json({ error: error.message }, { status: error.status });
    console.error("Mobile attendance history failed", error);
    return Response.json({ error: "Riwayat kehadiran belum dapat dimuat." }, { status: 500 });
  }
}
