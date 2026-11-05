import type { Metadata } from "next";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { employees } from "@/db/schema";
import { VisitListManager } from "@/features/visits/components/visit-list-manager";
import { listVisits } from "@/features/visits/server/visit-service";
import { dateInTimeZone, requireCompany } from "@/lib/current-company";

export const metadata: Metadata = { title: "Daftar Kunjungan" };

export default async function Page() {
  const context = await requireCompany();
  const today = dateInTimeZone(context.timezone);
  if (context.role === "employee") {
    // Staff see and record only their own visits.
    const [own] = await db.select({ id: employees.id, name: employees.name, employeeCode: employees.employeeCode }).from(employees)
      .where(and(eq(employees.companyId, context.companyId), eq(employees.userId, context.session.user.id), eq(employees.status, "active"))).limit(1);
    const rows = own ? await listVisits(context.companyId, undefined, undefined, own.id) : [];
    return <VisitListManager initialRows={rows} employees={own ? [own] : []} today={today} canWrite={Boolean(own)}/>;
  }
  const [rows, employeeRows] = await Promise.all([
    listVisits(context.companyId),
    db.select({ id: employees.id, name: employees.name, employeeCode: employees.employeeCode }).from(employees).where(eq(employees.companyId, context.companyId)).orderBy(asc(employees.name)),
  ]);
  return <VisitListManager initialRows={rows} employees={employeeRows} today={today} canWrite={["owner", "admin", "general_manager", "hrd", "manager"].includes(context.role)}/>;
}
