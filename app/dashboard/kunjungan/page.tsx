import type { Metadata } from "next";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { employees, visitLocations } from "@/db/schema";
import { VisitListManager } from "@/features/visits/components/visit-list-manager";
import { listVisits } from "@/features/visits/server/visit-service";
import { dateInTimeZone, requireCompany } from "@/lib/current-company";

export const metadata: Metadata = { title: "Daftar Kunjungan" };

export default async function Page() {
  const context = await requireCompany();
  const [rows, employeeRows, locations] = await Promise.all([
    listVisits(context.companyId),
    db.select({ id: employees.id, name: employees.name, employeeCode: employees.employeeCode }).from(employees).where(eq(employees.companyId, context.companyId)).orderBy(asc(employees.name)),
    db.select({ id: visitLocations.id, name: visitLocations.name, latitude: visitLocations.latitude, longitude: visitLocations.longitude }).from(visitLocations).where(eq(visitLocations.companyId, context.companyId)).orderBy(asc(visitLocations.name)),
  ]);
  return <VisitListManager initialRows={rows} employees={employeeRows} locations={locations} today={dateInTimeZone(context.timezone)} canWrite={["owner", "admin", "general_manager", "hrd", "manager"].includes(context.role)}/>;
}
