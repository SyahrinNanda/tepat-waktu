import type { Metadata } from "next";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { employees, visitLocationEmployees, visitLocations } from "@/db/schema";
import { VisitLocationManager } from "@/features/master-data/visit-locations/components/visit-location-manager";
import { requireCompanyRole } from "@/lib/current-company";

export const metadata: Metadata = { title: "Daftar Lokasi Kunjungan" };
export default async function Page() {
  const context = await requireCompanyRole(["admin", "general_manager", "hrd", "manager"]);
  const [rows, options, assignments] = await Promise.all([
    db.select().from(visitLocations).where(eq(visitLocations.companyId, context.companyId)).orderBy(asc(visitLocations.name)),
    db.select({ id: employees.id, name: employees.name, employeeCode: employees.employeeCode }).from(employees).where(and(eq(employees.companyId, context.companyId), eq(employees.status, "active"))).orderBy(asc(employees.name)),
    db.select({ locationId: visitLocationEmployees.visitLocationId, employeeId: visitLocationEmployees.employeeId }).from(visitLocationEmployees).innerJoin(visitLocations, eq(visitLocations.id, visitLocationEmployees.visitLocationId)).where(eq(visitLocations.companyId, context.companyId)),
  ]);
  const assigned = new Map<string, string[]>();
  for (const item of assignments) assigned.set(item.locationId, [...(assigned.get(item.locationId) ?? []), item.employeeId]);
  return <VisitLocationManager initialRows={rows.map((row) => ({ ...row, employeeIds: assigned.get(row.id) ?? [], employeeCount: assigned.get(row.id)?.length ?? 0 }))} employees={options} canManage={["admin", "general_manager", "hrd"].includes(context.role)}/>;
}
