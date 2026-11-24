import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { user } from "@/db/schema";
import { AttendanceError, selfAttendanceContext } from "@/features/attendance/server/attendance-service";
import { TIMEZONE_OPTIONS, TIMEZONE_VALUES } from "@/lib/timezone";

export const runtime = "nodejs";
function failure(error: unknown) {
  if (error instanceof AttendanceError) return Response.json({ error: error.message }, { status: error.status });
  console.error("Mobile profile failed", error);
  return Response.json({ error: "Profil belum dapat diproses." }, { status: 500 });
}

/** GET: the signed-in user's personal time zone and the zones they can choose. */
export async function GET(request: Request) {
  try {
    const context = await selfAttendanceContext(request);
    const [row] = await db.select({ timezone: user.timezone }).from(user).where(eq(user.id, context.userId)).limit(1);
    return Response.json({ timezone: row?.timezone ?? null, options: TIMEZONE_OPTIONS });
  } catch (error) { return failure(error); }
}

/** PATCH `{ timezone }`: same rule as the web profile form (WIB, WITA, or WIT). */
export async function PATCH(request: Request) {
  try {
    const context = await selfAttendanceContext(request);
    const parsed = z.object({ timezone: z.enum(TIMEZONE_VALUES, "Pilih zona waktu WIB, WITA, atau WIT.") }).safeParse(await request.json().catch(() => null));
    if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Zona waktu tidak valid." }, { status: 400 });
    await db.update(user).set({ timezone: parsed.data.timezone, updatedAt: new Date() }).where(eq(user.id, context.userId));
    return Response.json({ timezone: parsed.data.timezone });
  } catch (error) { return failure(error); }
}
