import { exportMonthlyAttendanceExcel } from "@/features/attendance/server/monthly-service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    return await exportMonthlyAttendanceExcel(request);
  } catch (error) {
    console.error("Monthly attendance export error:", error);
    return new Response(JSON.stringify({ message: "Gagal mengunduh laporan presensi bulanan." }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}
