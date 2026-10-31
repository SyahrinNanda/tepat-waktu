import { asc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { workSchedules } from "@/db/schema";
import { featureContext } from "@/features/generic-modules/server/feature-records";

const schema = z.object({ name: z.string().trim().min(2).max(100), graceMinutes: z.coerce.number().int().min(0).max(240), active: z.boolean().default(true) });

export async function GET(request: Request) {
  const context = await featureContext(request, "master/shift", "read");
  if ("error" in context) return context.error;
  const rows = await db.select().from(workSchedules).where(eq(workSchedules.companyId, context.companyId)).orderBy(asc(workSchedules.name));
  return Response.json({ rows });
}

export async function POST(request: Request) {
  const context = await featureContext(request, "master/shift", "write");
  if ("error" in context) return context.error;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Nama shift dan toleransi terlambat tidak valid." }, { status: 400 });
  try {
    const [row] = await db.insert(workSchedules).values({ companyId: context.companyId, name: parsed.data.name, graceMinutes: parsed.data.graceMinutes, active: parsed.data.active, workDays: "Senin–Minggu", startTime: "08:00:00", endTime: "17:00:00" }).returning();
    revalidatePath("/dashboard/master/shift"); revalidatePath("/dashboard/master/jam-kerja"); revalidatePath("/dashboard/master/divisi");
    return Response.json({ row }, { status: 201 });
  } catch (error) { return databaseError(error, "Shift dengan nama tersebut sudah tersedia."); }
}

function databaseError(error: unknown, duplicate: string) {
  const code = typeof error === "object" && error && "cause" in error && typeof error.cause === "object" && error.cause && "code" in error.cause ? error.cause.code : undefined;
  if (code === "23505") return Response.json({ error: duplicate }, { status: 409 });
  console.error("Shift mutation failed", error); return Response.json({ error: "Data shift belum dapat disimpan." }, { status: 500 });
}
