import { AttendanceError } from "@/features/attendance/server/attendance-service";
import { importMonthlyAttendanceExcel } from "@/features/attendance/server/monthly-service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    return await importMonthlyAttendanceExcel(request);
  } catch (error) {
    if (error instanceof AttendanceError) return Response.json({ message: error.message, error: error.message }, { status: error.status });
    console.error("Monthly attendance import error:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Gagal mengimpor data presensi." },
      { status: 500 }
    );
  }
}
