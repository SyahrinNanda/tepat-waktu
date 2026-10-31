import { and, asc, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { employees, visitLocationEmployees, visitLocations } from "@/db/schema";
import { featureContext } from "@/features/generic-modules/server/feature-records";
import { visitLocationInput } from "./schemas";

export async function GET(request: Request) {
  const context = await featureContext(request, "master/lokasi-kunjungan", "read");
  if ("error" in context) return context.error;
  const [locations, assignments] = await Promise.all([
    db.select().from(visitLocations).where(eq(visitLocations.companyId, context.companyId)).orderBy(asc(visitLocations.name)),
    db.select({ locationId: visitLocationEmployees.visitLocationId, employeeId: visitLocationEmployees.employeeId }).from(visitLocationEmployees).innerJoin(visitLocations, eq(visitLocations.id, visitLocationEmployees.visitLocationId)).where(eq(visitLocations.companyId, context.companyId)),
  ]);
  const employeeIds = new Map<string, string[]>();
  for (const assignment of assignments) employeeIds.set(assignment.locationId, [...(employeeIds.get(assignment.locationId) ?? []), assignment.employeeId]);
  return Response.json({ rows: locations.map((row) => ({ ...row, employeeIds: employeeIds.get(row.id) ?? [], employeeCount: employeeIds.get(row.id)?.length ?? 0 })) });
}

export async function POST(request: Request) {
  const context = await featureContext(request, "master/lokasi-kunjungan", "write");
  if ("error" in context) return context.error;
  const parsed = visitLocationInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Lengkapi data lokasi kunjungan dan pastikan koordinat serta radius valid." }, { status: 400 });
  const { employeeIds: requestedIds, allEmployees, email, ...values } = parsed.data;
  try {
    const row = await db.transaction(async (tx) => {
      const employeeRows = allEmployees
        ? await tx.select({ id: employees.id }).from(employees).where(and(eq(employees.companyId, context.companyId), eq(employees.status, "active")))
        : requestedIds.length
          ? await tx.select({ id: employees.id }).from(employees).where(and(eq(employees.companyId, context.companyId), eq(employees.status, "active"), inArray(employees.id, requestedIds)))
          : [];
      if (!allEmployees && employeeRows.length !== new Set(requestedIds).size) throw new Error("INVALID_EMPLOYEES");
      const [created] = await tx.insert(visitLocations).values({ companyId: context.companyId, ...values, email: email || null }).returning();
      if (employeeRows.length) await tx.insert(visitLocationEmployees).values(employeeRows.map((employee) => ({ visitLocationId: created.id, employeeId: employee.id })));
      return { ...created, employeeIds: employeeRows.map((employee) => employee.id), employeeCount: employeeRows.length };
    });
    revalidatePath("/dashboard/master/lokasi-kunjungan");
    return Response.json({ row }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_EMPLOYEES") return Response.json({ error: "Pilihan karyawan tidak valid." }, { status: 400 });
    return Response.json({ error: "Nama lokasi kunjungan sudah digunakan." }, { status: 409 });
  }
}
