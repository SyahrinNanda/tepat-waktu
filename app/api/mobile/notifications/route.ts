import { AttendanceError, selfAttendanceContext } from "@/features/attendance/server/attendance-service";
import { markNotificationsSeen, notificationFeed } from "@/features/notifications/server/notifications";

export const runtime = "nodejs";

/** GET: the same bell feed as the web dashboard, for the signed-in mobile user. */
export async function GET(request: Request) {
  try {
    const context = await selfAttendanceContext(request);
    return Response.json(await notificationFeed({ companyId: context.companyId, userId: context.userId, role: context.role, isSuperAdmin: false }));
  } catch (error) {
    if (error instanceof AttendanceError) return Response.json({ error: error.message }, { status: error.status });
    console.error("Mobile notifications failed", error);
    return Response.json({ error: "Notifikasi belum dapat dimuat." }, { status: 500 });
  }
}

/** POST: marks every current notification as seen (the bell was opened). */
export async function POST(request: Request) {
  try {
    const context = await selfAttendanceContext(request);
    await markNotificationsSeen(context.userId);
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof AttendanceError) return Response.json({ error: error.message }, { status: error.status });
    console.error("Mobile notifications mark-seen failed", error);
    return Response.json({ error: "Notifikasi belum dapat diperbarui." }, { status: 500 });
  }
}
