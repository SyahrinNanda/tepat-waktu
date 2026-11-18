import { and, count, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { employees, divisions } from "@/db/schema";
import { featureContext } from "@/features/generic-modules/server/feature-records";

type Params = { params: Promise<{ id: string }> };
const inputSchema = z.object({ name: z.string().trim().min(2).max(100), active: z.boolean() });

export async function PATCH(request: Request, { params }: Params) {
  const context = await featureContext(request, "master/divisi", "write");
  if ("error" in context) return context.error;
  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Data divisi tidak valid." }, { status: 400 });
  try {
    const id = (await params).id;
    const row = await db.transaction(async (tx) => {
      const [existing] = await tx.select({ name: divisions.name }).from(divisions).where(and(eq(divisions.id, id), eq(divisions.companyId, context.companyId))).limit(1);
      if (!existing) return null;
      const [updated] = await tx.update(divisions).set({ ...parsed.data, updatedAt: new Date() }).where(eq(divisions.id, id)).returning();
      if (existing.name !== updated.name) await tx.update(employees).set({ department: updated.name }).where(and(eq(employees.companyId, context.companyId), eq(employees.department, existing.name)));
      return updated;
    });
    if (!row) return Response.json({ error: "Divisi tidak ditemukan." }, { status: 404 });
    const [assigned] = await db.select({ value: count() }).from(employees).where(and(eq(employees.companyId, context.companyId), eq(employees.department, row.name)));
    revalidatePath("/dashboard/master/divisi");
    return Response.json({ row: { ...row, employeeCount: Number(assigned.value) } });
  } catch {
    return Response.json({ error: "Nama divisi sudah digunakan." }, { status: 409 });
  }
}

export async function DELETE(request: Request, { params }: Params) {
  const context = await featureContext(request, "master/divisi", "manage");
  if ("error" in context) return context.error;
  const id = (await params).id;
  const [department] = await db.select({ name: divisions.name }).from(divisions).where(and(eq(divisions.id, id), eq(divisions.companyId, context.companyId))).limit(1);
  if (!department) return Response.json({ error: "Divisi tidak ditemukan." }, { status: 404 });
  const [assigned] = await db.select({ value: count() }).from(employees).where(and(eq(employees.companyId, context.companyId), eq(employees.department, department.name)));
  if (Number(assigned.value) > 0) return Response.json({ error: "Divisi masih digunakan oleh karyawan dan tidak dapat dihapus." }, { status: 409 });
  await db.delete(divisions).where(and(eq(divisions.id, id), eq(divisions.companyId, context.companyId)));
  revalidatePath("/dashboard/master/divisi");
  return Response.json({ ok: true });
}
