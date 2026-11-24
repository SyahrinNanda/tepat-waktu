import { AttendanceError, attendanceManagerContext } from "@/features/attendance/server/attendance-service";
import { generateMonthlyAttendanceTemplate } from "@/features/attendance/server/monthly-service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await attendanceManagerContext(request);
    return await generateMonthlyAttendanceTemplate();
  } catch (error) {
    if (error instanceof AttendanceError) return Response.json({ message: error.message, error: error.message }, { status: error.status });
    console.error("Monthly attendance template error:", error);
    return new Response(JSON.stringify({ message: "Gagal mengunduh template kehadiran." }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}
