import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { pushTokens } from "@/db/schema";
import { AttendanceError, selfAttendanceContext } from "@/features/attendance/server/attendance-service";
import { EXPO_TOKEN } from "@/features/notifications/server/push";

export const runtime = "nodejs";
const tokenSchema = z.string().trim().regex(EXPO_TOKEN, "Token push tidak valid.");
function failure(error: unknown) {
  if (error instanceof AttendanceError) return Response.json({ error: error.message }, { status: error.status });
  console.error("Mobile push token failed", error);
  return Response.json({ error: "Token push belum dapat disimpan." }, { status: 500 });
}

/** POST `{ token, platform }`: registers this device for push (a token moves to whoever signs in on it). */
export async function POST(request: Request) {
  try {
    const context = await selfAttendanceContext(request);
    const parsed = z.object({ token: tokenSchema, platform: z.enum(["ios", "android"]) }).safeParse(await request.json().catch(() => null));
    if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Data tidak valid." }, { status: 400 });
    await db.insert(pushTokens).values({ userId: context.userId, token: parsed.data.token, platform: parsed.data.platform })
      .onConflictDoUpdate({ target: pushTokens.token, set: { userId: context.userId, platform: parsed.data.platform, updatedAt: new Date() } });
    return Response.json({ ok: true });
  } catch (error) { return failure(error); }
}

/** DELETE `{ token }`: stops push to this device (called before signing out). */
export async function DELETE(request: Request) {
  try {
    const context = await selfAttendanceContext(request);
    const parsed = z.object({ token: tokenSchema }).safeParse(await request.json().catch(() => null));
    if (!parsed.success) return Response.json({ error: "Token push tidak valid." }, { status: 400 });
    await db.delete(pushTokens).where(and(eq(pushTokens.token, parsed.data.token), eq(pushTokens.userId, context.userId)));
    return Response.json({ ok: true });
  } catch (error) { return failure(error); }
}
