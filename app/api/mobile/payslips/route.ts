import { AttendanceError, selfAttendanceContext } from "@/features/attendance/server/attendance-service";
import { getFinalPayslip, listFinalPeriods } from "@/features/payslips/server/payslip-service";

export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const context = await selfAttendanceContext(request);
    const params = new URL(request.url).searchParams;
    const year = Number(params.get("year"));
    const month = Number(params.get("month"));
    if (Number.isInteger(year) && year >= 2000 && year <= 2100 && Number.isInteger(month) && month >= 1 && month <= 12) {
      const slip = await getFinalPayslip(context.companyId, context.employeeId, year, month);
      return slip ? Response.json({ row: slip }) : Response.json({ error: "Slip gaji tidak ditemukan." }, { status: 404 });
    }
    return Response.json({ rows: await listFinalPeriods(context.companyId, context.employeeId) });
  } catch (error) {
    if (error instanceof AttendanceError) return Response.json({ error: error.message }, { status: error.status });
    console.error("Mobile payslips failed", error);
    return Response.json({ error: "Slip gaji belum dapat dimuat." }, { status: 500 });
  }
}
