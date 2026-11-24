import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { companies } from "@/db/schema";
import { AttendanceError, selfAttendanceContext } from "@/features/attendance/server/attendance-service";
import { LEAVE_ELIGIBILITY } from "@/features/leave-requests/annual-leave";
import { getLeaveRules } from "@/features/leave-requests/server/annual-balance";

export const runtime = "nodejs";

const schema = z.object({
  days: z.number().int().min(0).max(60),
  eligibility: z.enum(LEAVE_ELIGIBILITY),
  carryOver: z.boolean(),
  carryOverMax: z.number().int().min(1).max(60).nullable(),
});

async function contextFor(request: Request) {
  const context = await selfAttendanceContext(request);
  if (!["hrd", "general_manager"].includes(context.role)) throw new AttendanceError("Akses aturan cuti ditolak.", 403);
  return context;
}

function failure(error: unknown) {
  if (error instanceof AttendanceError) return Response.json({ error: error.message }, { status: error.status });
  console.error("Mobile leave rules failed", error);
  return Response.json({ error: "Aturan cuti belum dapat diproses." }, { status: 500 });
}

export async function GET(request: Request) {
  try {
    const context = await contextFor(request);
    return Response.json({ row: await getLeaveRules(context.companyId) });
  } catch (error) { return failure(error); }
}

export async function PUT(request: Request) {
  try {
    const context = await contextFor(request);
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message || "Aturan cuti tidak valid." }, { status: 400 });
    const rules = parsed.data;
    await db.update(companies).set({
      annualLeaveDays: rules.days,
      annualLeaveEligibility: rules.eligibility,
      annualLeaveCarryOver: rules.carryOver,
      annualLeaveCarryOverMax: rules.carryOver ? rules.carryOverMax : null,
      updatedAt: new Date(),
    }).where(eq(companies.id, context.companyId));
    return Response.json({ ok: true });
  } catch (error) { return failure(error); }
}
