import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { positions } from "@/db/schema";
import { featureContext } from "@/features/generic-modules/server/feature-records";
import { positionBodySchema, listPositionsWithSchedules, replacePositionSchedules, schedulesBelongToCompany } from "@/features/master-data/positions/server/position-schedules";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const context = await featureContext(request, "master/jabatan", "write"); if ("error" in context) return context.error;
  const parsed = positionBodySchema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return Response.json({ error: "Nama dan minimal satu jadwal kerja wajib diisi." }, { status: 400 });
  const { scheduleIds, ...values } = parsed.data;
  if (!(await schedulesBelongToCompany(context.companyId, scheduleIds))) return Response.json({ error: "Jadwal kerja tidak ditemukan." }, { status: 404 });
  const id = (await params).id;
  try {
    const found = await db.transaction(async (tx) => {
      const [row] = await tx.update(positions).set({ ...values, scheduleId: scheduleIds[0], updatedAt: new Date() }).where(and(eq(positions.id, id), eq(positions.companyId, context.companyId))).returning({ id: positions.id });
      if (!row) return false;
      await replacePositionSchedules(tx, row.id, scheduleIds);
      return true;
    });
    if (!found) return Response.json({ error: "Jabatan tidak ditemukan." }, { status: 404 });
    revalidatePath("/dashboard/master/jabatan");
    const [row] = await listPositionsWithSchedules(context.companyId, id);
    return Response.json({ row });
  } catch { return Response.json({ error: "Nama jabatan sudah digunakan." }, { status: 409 }); }
}

export async function DELETE(request: Request, { params }: Params) {
  const context = await featureContext(request, "master/jabatan", "manage"); if ("error" in context) return context.error;
  const [row] = await db.delete(positions).where(and(eq(positions.id, (await params).id), eq(positions.companyId, context.companyId))).returning({ id: positions.id });
  if (!row) return Response.json({ error: "Jabatan tidak ditemukan." }, { status: 404 }); revalidatePath("/dashboard/master/jabatan"); return Response.json({ ok: true });
}
