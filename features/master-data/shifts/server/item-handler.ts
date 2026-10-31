import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { workSchedules } from "@/db/schema";
import { featureContext } from "@/features/generic-modules/server/feature-records";

type Params = { params: Promise<{ id: string }> };
const schema = z.object({ name: z.string().trim().min(2).max(100), graceMinutes: z.coerce.number().int().min(0).max(240), active: z.boolean() });

export async function PATCH(request: Request, { params }: Params) {
  const context = await featureContext(request, "master/shift", "write"); if ("error" in context) return context.error;
  const parsed = schema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return Response.json({ error: "Data shift tidak valid." }, { status: 400 });
  try {
    const [row] = await db.update(workSchedules).set(parsed.data).where(and(eq(workSchedules.id, (await params).id), eq(workSchedules.companyId, context.companyId))).returning();
    if (!row) return Response.json({ error: "Shift tidak ditemukan." }, { status: 404 });
    revalidatePath("/dashboard/master/shift"); return Response.json({ row });
  } catch (error) { console.error("Update shift failed", error); return Response.json({ error: "Perubahan shift belum dapat disimpan." }, { status: 409 }); }
}

export async function DELETE(request: Request, { params }: Params) {
  const context = await featureContext(request, "master/shift", "manage"); if ("error" in context) return context.error;
  try {
    const [row] = await db.delete(workSchedules).where(and(eq(workSchedules.id, (await params).id), eq(workSchedules.companyId, context.companyId))).returning({ id: workSchedules.id });
    if (!row) return Response.json({ error: "Shift tidak ditemukan." }, { status: 404 });
    revalidatePath("/dashboard/master/shift"); revalidatePath("/dashboard/master/jam-kerja"); return Response.json({ ok: true });
  } catch { return Response.json({ error: "Shift masih digunakan oleh divisi. Pindahkan divisi terlebih dahulu." }, { status: 409 }); }
}
