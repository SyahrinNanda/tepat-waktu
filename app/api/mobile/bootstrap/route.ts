import { getAppSession } from "@/lib/app-session";
import { AttendanceError, selfAttendanceContext } from "@/features/attendance/server/attendance-service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const context = await selfAttendanceContext(request);
    const session = await getAppSession(request.headers);
    if (!session) return Response.json({ error: "Silakan masuk kembali." }, { status: 401 });
    return Response.json({
      user: { id: session.user.id, name: session.user.name, email: session.user.email },
      company: { id: context.companyId, name: context.companyName, timezone: context.timezone },
      role: context.role,
      employee: { id: context.employeeId, name: context.employeeName },
    });
  } catch (error) {
    if (error instanceof AttendanceError) return Response.json({ error: error.message }, { status: error.status });
    console.error("Mobile bootstrap failed", error);
    return Response.json({ error: "Akun belum dapat dimuat." }, { status: 500 });
  }
}