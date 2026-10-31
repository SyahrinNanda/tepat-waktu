import { generateMonthlyAttendanceTemplate } from "@/features/attendance/server/monthly-service";

export const runtime = "nodejs";

export async function GET() {
  try {
    return await generateMonthlyAttendanceTemplate();
  } catch (error) {
    console.error("Monthly attendance template error:", error);
    return new Response(JSON.stringify({ message: "Gagal mengunduh template presensi." }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}
