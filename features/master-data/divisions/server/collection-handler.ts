import { and, asc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { divisions, workSchedules } from "@/db/schema";
import { featureContext } from "@/features/generic-modules/server/feature-records";

const schema = z.object({ name: z.string().trim().min(2).max(100), scheduleId: z.uuid(), active: z.boolean().default(true) });

export async function GET(request: Request) {
  const context = await featureContext(request, "master/divisi", "read"); if ("error" in context) return context.error;
  const rows = await db.select({ id: divisions.id, name: divisions.name, scheduleId: divisions.scheduleId, shiftName: workSchedules.name, active: divisions.active, createdAt: divisions.createdAt, updatedAt: divisions.updatedAt }).from(divisions).leftJoin(workSchedules, eq(divisions.scheduleId, workSchedules.id)).where(eq(divisions.companyId, context.companyId)).orderBy(asc(divisions.name));
  return Response.json({ rows });
}

export async function POST(request: Request) {
  const context = await featureContext(request, "master/divisi", "write"); if ("error" in context) return context.error;
  const parsed = schema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return Response.json({ error: "Nama dan shift wajib diisi." }, { status: 400 });
  const [shift] = await db.select({ id: workSchedules.id }).from(workSchedules).where(and(eq(workSchedules.id, parsed.data.scheduleId), eq(workSchedules.companyId, context.companyId))).limit(1);
  if (!shift) return Response.json({ error: "Shift tidak ditemukan." }, { status: 404 });
  try {
    const [row] = await db.insert(divisions).values({ companyId: context.companyId, payrollCalculation: "monthly", ...parsed.data }).returning(); revalidatePath("/dashboard/master/divisi"); return Response.json({ row }, { status: 201 });
  } catch { return Response.json({ error: "Nama divisi sudah digunakan." }, { status: 409 }); }
}
