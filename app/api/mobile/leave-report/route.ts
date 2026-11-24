import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { employees, leaveRequests } from "@/db/schema";
import { AttendanceError, selfAttendanceContext } from "@/features/attendance/server/attendance-service";
import { getAppSettings, MENU_DISABLED_MESSAGE, menusBlockedFor } from "@/features/access/app-settings";
import { accessScope, employeeScopeFilter } from "@/features/access/team-scope";

export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const context = await selfAttendanceContext(request);
    if (context.role === "employee") return Response.json({ error: "Akses ditolak." }, { status: 403 });
    const blockedMenus = menusBlockedFor(context.role, await getAppSettings(context.companyId));
    if (["menuLaporan"].some((menu) => (blockedMenus as string[]).includes(menu))) return Response.json({ error: MENU_DISABLED_MESSAGE }, { status: 403 });
    const rows = await db.select({
      id: leaveRequests.id, employeeId: employees.id, name: employees.name,
      department: employees.department, type: leaveRequests.type,
      specialLeaveName: leaveRequests.specialLeaveName, workDays: leaveRequests.workDays,
      startDate: leaveRequests.startDate, endDate: leaveRequests.endDate,
      status: leaveRequests.status,
    }).from(leaveRequests).innerJoin(employees, eq(leaveRequests.employeeId, employees.id))
      .where(and(eq(leaveRequests.companyId, context.companyId), eq(leaveRequests.status, "approved"), employeeScopeFilter(await accessScope(context))))
      .orderBy(desc(leaveRequests.startDate)).limit(1000);
    return Response.json({ rows });
  } catch (error) {
    if (error instanceof AttendanceError) return Response.json({ error: error.message }, { status: error.status });
    console.error("Mobile leave report failed", error);
    return Response.json({ error: "Laporan cuti belum dapat dimuat." }, { status: 500 });
  }
}
