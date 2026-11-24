import { and, count, eq, gte } from "drizzle-orm";
import { db } from "@/db";
import { attendances, employees } from "@/db/schema";
import { AttendanceError, selfAttendanceContext } from "@/features/attendance/server/attendance-service";
import { getAppSettings, MENU_DISABLED_MESSAGE, menusBlockedFor } from "@/features/access/app-settings";
import { dateInTimeZone } from "@/lib/current-company";
import { accessScope, employeeScopeFilter } from "@/features/access/team-scope";

export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const context = await selfAttendanceContext(request);
    if (context.role === "employee") return Response.json({ error: "Akses ditolak." }, { status: 403 });
    const blockedMenus = menusBlockedFor(context.role, await getAppSettings(context.companyId));
    if (["menuLaporan"].some((menu) => (blockedMenus as string[]).includes(menu))) return Response.json({ error: MENU_DISABLED_MESSAGE }, { status: 403 });
    const today = dateInTimeZone(context.timezone);
    const start = new Date(`${today}T00:00:00Z`); start.setUTCDate(start.getUTCDate() - 29);
    const startDate = start.toISOString().slice(0, 10);
    const teamFilter = employeeScopeFilter(await accessScope(context));
    const [byStatus, byPosition] = await Promise.all([
      db.select({ status: attendances.status, value: count() }).from(attendances).innerJoin(employees, eq(attendances.employeeId, employees.id))
        .where(and(eq(attendances.companyId, context.companyId), gte(attendances.attendanceDate, startDate), teamFilter)).groupBy(attendances.status),
      db.select({ position: employees.position, value: count() }).from(employees)
        .where(and(eq(employees.companyId, context.companyId), eq(employees.status, "active"), teamFilter)).groupBy(employees.position),
    ]);
    const statuses = Object.fromEntries(byStatus.map((row) => [row.status, Number(row.value)]));
    const total = byStatus.reduce((sum, row) => sum + Number(row.value), 0);
    return Response.json({
      period: { from: startDate, to: today }, total,
      presenceRate: total ? Math.round(((statuses.present || 0) + (statuses.late || 0)) / total * 100) : 0,
      statuses, positions: byPosition.map((row) => ({ name: row.position, count: Number(row.value) })),
    });
  } catch (error) {
    if (error instanceof AttendanceError) return Response.json({ error: error.message }, { status: error.status });
    console.error("Mobile reports failed", error);
    return Response.json({ error: "Laporan belum dapat dimuat." }, { status: 500 });
  }
}
