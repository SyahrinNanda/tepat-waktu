import { and, count, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { employees, jobPositions } from "@/db/schema";
import { featureContext } from "@/features/generic-modules/server/feature-records";

type Params = { params: Promise<{ id: string }> };
const inputSchema = z.object({ name: z.string().trim().min(2).max(100), active: z.boolean() });

export async function PATCH(request: Request, { params }: Params) {
  const context = await featureContext(request, "master/jabatan", "write");
  if ("error" in context) return context.error;
  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Data jabatan tidak valid." }, { status: 400 });
  try {
    const id = (await params).id;
    const row = await db.transaction(async (tx) => {
      const [existing] = await tx.select({ name: jobPositions.name }).from(jobPositions).where(and(eq(jobPositions.id, id), eq(jobPositions.companyId, context.companyId))).limit(1);
      if (!existing) return null;
      const [updated] = await tx.update(jobPositions).set({ ...parsed.data, updatedAt: new Date() }).where(eq(jobPositions.id, id)).returning();
      if (existing.name !== updated.name) await tx.update(employees).set({ position: updated.name }).where(and(eq(employees.companyId, context.companyId), eq(employees.position, existing.name)));
      return updated;
    });
    if (!row) return Response.json({ error: "Jabatan tidak ditemukan." }, { status: 404 });
    const [assigned] = await db.select({ value: count() }).from(employees).where(and(eq(employees.companyId, context.companyId), eq(employees.position, row.name)));
    revalidatePath("/dashboard/master/jabatan");
    return Response.json({ row: { ...row, employeeCount: Number(assigned.value) } });
  } catch {
    return Response.json({ error: "Nama jabatan sudah digunakan." }, { status: 409 });
  }
}

export async function DELETE(request: Request, { params }: Params) {
  const context = await featureContext(request, "master/jabatan", "manage");
  if ("error" in context) return context.error;
  const id = (await params).id;
  const [position] = await db.select({ name: jobPositions.name }).from(jobPositions).where(and(eq(jobPositions.id, id), eq(jobPositions.companyId, context.companyId))).limit(1);
  if (!position) return Response.json({ error: "Jabatan tidak ditemukan." }, { status: 404 });
  const [assigned] = await db.select({ value: count() }).from(employees).where(and(eq(employees.companyId, context.companyId), eq(employees.position, position.name)));
  if (Number(assigned.value) > 0) return Response.json({ error: "Jabatan masih digunakan oleh karyawan dan tidak dapat dihapus." }, { status: 409 });
  await db.delete(jobPositions).where(and(eq(jobPositions.id, id), eq(jobPositions.companyId, context.companyId)));
  revalidatePath("/dashboard/master/jabatan");
  return Response.json({ ok: true });
}
