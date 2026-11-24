import { and, count, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { employees, positions } from "@/db/schema";
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
    // Employees are linked to a jabatan by name, and an inactive jabatan gives no schedule: keep both in step.
    const result = await db.transaction(async (tx) => {
      const [existing] = await tx.select({ name: positions.name, active: positions.active }).from(positions).where(and(eq(positions.id, id), eq(positions.companyId, context.companyId))).for("update").limit(1);
      if (!existing) return "missing" as const;
      if (existing.active && !values.active) {
        const [assigned] = await tx.select({ value: count() }).from(employees).where(and(eq(employees.companyId, context.companyId), eq(employees.position, existing.name), eq(employees.status, "active")));
        if (Number(assigned.value) > 0) return { activeEmployees: Number(assigned.value) };
      }
      await tx.update(positions).set({ ...values, scheduleId: scheduleIds[0], updatedAt: new Date() }).where(eq(positions.id, id));
      if (existing.name !== values.name) await tx.update(employees).set({ position: values.name }).where(and(eq(employees.companyId, context.companyId), eq(employees.position, existing.name)));
      await replacePositionSchedules(tx, id, scheduleIds);
      return "saved" as const;
    });
    if (result === "missing") return Response.json({ error: "Jabatan tidak ditemukan." }, { status: 404 });
    if (result !== "saved") return Response.json({ error: `Jabatan masih dipakai ${result.activeEmployees} karyawan aktif. Pindahkan karyawan ke jabatan lain sebelum menonaktifkan.` }, { status: 409 });
    revalidatePath("/dashboard/master/jabatan");
    const [row] = await listPositionsWithSchedules(context.companyId, id);
    return Response.json({ row });
  } catch { return Response.json({ error: "Nama jabatan sudah digunakan." }, { status: 409 }); }
}

export async function DELETE(request: Request, { params }: Params) {
  const context = await featureContext(request, "master/jabatan", "manage"); if ("error" in context) return context.error;
  const id = (await params).id;
  const [position] = await db.select({ name: positions.name }).from(positions).where(and(eq(positions.id, id), eq(positions.companyId, context.companyId))).limit(1);
  if (!position) return Response.json({ error: "Jabatan tidak ditemukan." }, { status: 404 });
  const [assigned] = await db.select({ value: count() }).from(employees).where(and(eq(employees.companyId, context.companyId), eq(employees.position, position.name)));
  if (Number(assigned.value) > 0) return Response.json({ error: `Jabatan masih dipakai ${assigned.value} karyawan. Pindahkan karyawan ke jabatan lain sebelum menghapus.` }, { status: 409 });
  const [row] = await db.delete(positions).where(and(eq(positions.id, id), eq(positions.companyId, context.companyId))).returning({ id: positions.id });
  if (!row) return Response.json({ error: "Jabatan tidak ditemukan." }, { status: 404 }); revalidatePath("/dashboard/master/jabatan"); return Response.json({ ok: true });
}
