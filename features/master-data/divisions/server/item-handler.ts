import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { divisions, workSchedules } from "@/db/schema";
import { featureContext } from "@/features/generic-modules/server/feature-records";

type Params = { params: Promise<{ id: string }> };
const schema = z.object({ name: z.string().trim().min(2).max(100), scheduleId: z.uuid(), active: z.boolean() });

export async function PATCH(request: Request, { params }: Params) {
  const context = await featureContext(request, "master/divisi", "write"); if ("error" in context) return context.error;
  const parsed = schema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return Response.json({ error: "Data divisi tidak valid." }, { status: 400 });
  const [shift] = await db.select({ id: workSchedules.id }).from(workSchedules).where(and(eq(workSchedules.id, parsed.data.scheduleId), eq(workSchedules.companyId, context.companyId))).limit(1);
  if (!shift) return Response.json({ error: "Jadwal kerja tidak ditemukan." }, { status: 404 });
  try {
    const [row] = await db.update(divisions).set({ ...parsed.data, updatedAt: new Date() }).where(and(eq(divisions.id, (await params).id), eq(divisions.companyId, context.companyId))).returning();
    if (!row) return Response.json({ error: "Divisi tidak ditemukan." }, { status: 404 }); revalidatePath("/dashboard/master/divisi"); return Response.json({ row });
  } catch { return Response.json({ error: "Nama divisi sudah digunakan." }, { status: 409 }); }
}

export async function DELETE(request: Request, { params }: Params) {
  const context = await featureContext(request, "master/divisi", "manage"); if ("error" in context) return context.error;
  const [row] = await db.delete(divisions).where(and(eq(divisions.id, (await params).id), eq(divisions.companyId, context.companyId))).returning({ id: divisions.id });
  if (!row) return Response.json({ error: "Divisi tidak ditemukan." }, { status: 404 }); revalidatePath("/dashboard/master/divisi"); return Response.json({ ok: true });
}
