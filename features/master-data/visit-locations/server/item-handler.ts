import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { employees, visitLocationEmployees, visitLocations } from "@/db/schema";
import { featureContext } from "@/features/generic-modules/server/feature-records";
import { visitLocationInput } from "./schemas";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const context = await featureContext(request, "master/lokasi-kunjungan", "write");
  if ("error" in context) return context.error;
  const parsed = visitLocationInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Data lokasi kunjungan tidak valid." }, { status: 400 });
  const id = (await params).id;
  const { employeeIds: requestedIds, allEmployees, email, ...values } = parsed.data;
  try {
    const row = await db.transaction(async (tx) => {
      const [existing] = await tx.select({ id: visitLocations.id }).from(visitLocations).where(and(eq(visitLocations.id, id), eq(visitLocations.companyId, context.companyId))).limit(1);
      if (!existing) return null;
      const employeeRows = allEmployees
        ? await tx.select({ id: employees.id }).from(employees).where(and(eq(employees.companyId, context.companyId), eq(employees.status, "active")))
        : requestedIds.length
          ? await tx.select({ id: employees.id }).from(employees).where(and(eq(employees.companyId, context.companyId), eq(employees.status, "active"), inArray(employees.id, requestedIds)))
          : [];
      if (!allEmployees && employeeRows.length !== new Set(requestedIds).size) throw new Error("INVALID_EMPLOYEES");
      const [updated] = await tx.update(visitLocations).set({ ...values, email: email || null, updatedAt: new Date() }).where(eq(visitLocations.id, id)).returning();
      await tx.delete(visitLocationEmployees).where(eq(visitLocationEmployees.visitLocationId, id));
      if (employeeRows.length) await tx.insert(visitLocationEmployees).values(employeeRows.map((employee) => ({ visitLocationId: id, employeeId: employee.id })));
      return { ...updated, employeeIds: employeeRows.map((employee) => employee.id), employeeCount: employeeRows.length };
    });
    if (!row) return Response.json({ error: "Lokasi kunjungan tidak ditemukan." }, { status: 404 });
    revalidatePath("/dashboard/master/lokasi-kunjungan");
    return Response.json({ row });
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_EMPLOYEES") return Response.json({ error: "Pilihan karyawan tidak valid." }, { status: 400 });
    return Response.json({ error: "Nama lokasi kunjungan sudah digunakan." }, { status: 409 });
  }
}

export async function DELETE(request: Request, { params }: Params) {
  const context = await featureContext(request, "master/lokasi-kunjungan", "manage");
  if ("error" in context) return context.error;
  const [row] = await db.delete(visitLocations).where(and(eq(visitLocations.id, (await params).id), eq(visitLocations.companyId, context.companyId))).returning({ id: visitLocations.id });
  if (!row) return Response.json({ error: "Lokasi kunjungan tidak ditemukan." }, { status: 404 });
  revalidatePath("/dashboard/master/lokasi-kunjungan");
  return Response.json({ ok: true });
}
