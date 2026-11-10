import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { divisions } from "@/db/schema";
import { featureContext } from "@/features/generic-modules/server/feature-records";
import { divisionBodySchema, listDivisionsWithSchedules, replaceDivisionSchedules, schedulesBelongToCompany } from "@/features/master-data/divisions/server/division-schedules";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const context = await featureContext(request, "master/divisi", "write"); if ("error" in context) return context.error;
  const parsed = divisionBodySchema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return Response.json({ error: "Nama dan minimal satu jadwal kerja wajib diisi." }, { status: 400 });
  const { scheduleIds, ...values } = parsed.data;
  if (!(await schedulesBelongToCompany(context.companyId, scheduleIds))) return Response.json({ error: "Jadwal kerja tidak ditemukan." }, { status: 404 });
  const id = (await params).id;
  try {
    const found = await db.transaction(async (tx) => {
      const [row] = await tx.update(divisions).set({ ...values, scheduleId: scheduleIds[0], updatedAt: new Date() }).where(and(eq(divisions.id, id), eq(divisions.companyId, context.companyId))).returning({ id: divisions.id });
      if (!row) return false;
      await replaceDivisionSchedules(tx, row.id, scheduleIds);
      return true;
    });
    if (!found) return Response.json({ error: "Divisi tidak ditemukan." }, { status: 404 });
    revalidatePath("/dashboard/master/divisi");
    const [row] = await listDivisionsWithSchedules(context.companyId, id);
    return Response.json({ row });
  } catch { return Response.json({ error: "Nama divisi sudah digunakan." }, { status: 409 }); }
}

export async function DELETE(request: Request, { params }: Params) {
  const context = await featureContext(request, "master/divisi", "manage"); if ("error" in context) return context.error;
  const [row] = await db.delete(divisions).where(and(eq(divisions.id, (await params).id), eq(divisions.companyId, context.companyId))).returning({ id: divisions.id });
  if (!row) return Response.json({ error: "Divisi tidak ditemukan." }, { status: 404 }); revalidatePath("/dashboard/master/divisi"); return Response.json({ ok: true });
}
