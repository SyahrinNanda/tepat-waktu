import { importMonthlyAttendanceExcel } from "@/features/attendance/server/monthly-service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    return await importMonthlyAttendanceExcel(request);
  } catch (error) {
    console.error("Monthly attendance import error:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Gagal mengimpor data presensi." },
      { status: 500 }
    );
  }
}
