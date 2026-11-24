import { AttendanceError, selfAttendanceContext } from "@/features/attendance/server/attendance-service";
import { getAppSettings, MENU_DISABLED_MESSAGE, menusBlockedFor } from "@/features/access/app-settings";
import { visitReports } from "@/features/visits/server/visit-service";
import { dateInTimeZone } from "@/lib/current-company";
import { accessScope, employeeScopeFilter } from "@/features/access/team-scope";

export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const context = await selfAttendanceContext(request);
    // A company-wide report is restricted to management, even though staff can record their own visits.
    if (context.role === "employee") return Response.json({ error: "Akses ditolak." }, { status: 403 });
    const blockedMenus = menusBlockedFor(context.role, await getAppSettings(context.companyId));
    if (["menuKunjungan", "menuLaporan"].some((menu) => (blockedMenus as string[]).includes(menu))) return Response.json({ error: MENU_DISABLED_MESSAGE }, { status: 403 });
    const today = dateInTimeZone(context.timezone);
    const start = new Date(`${today}T00:00:00Z`); start.setUTCDate(start.getUTCDate() - 6);
    const params = new URL(request.url).searchParams;
    const from = params.get("from") || start.toISOString().slice(0, 10);
    const to = params.get("to") || today;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || from > to || Date.parse(to) - Date.parse(from) > 366 * 86400000) {
      return Response.json({ error: "Periode laporan tidak valid." }, { status: 400 });
    }
    const rows = await visitReports(context.companyId, from, to, employeeScopeFilter(await accessScope(context)));
    return Response.json({ period: { from, to }, rows: rows.map((row) => ({ ...row, id: row.employeeId })) });
  } catch (error) {
    if (error instanceof AttendanceError) return Response.json({ error: error.message }, { status: error.status });
    console.error("Mobile visit report failed", error);
    return Response.json({ error: "Laporan kunjungan belum dapat dimuat." }, { status: 500 });
  }
}
