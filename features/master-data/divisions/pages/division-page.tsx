import type { Metadata } from "next";
import { asc, count, eq } from "drizzle-orm";
import { db } from "@/db";
import { employees, divisions } from "@/db/schema";
import { DivisionManager } from "@/features/master-data/divisions/components/division-manager";
import { requireCompanyRole } from "@/lib/current-company";

export const metadata: Metadata = { title: "Daftar Divisi" };
export default async function Page() {
  const context = await requireCompanyRole(["admin", "general_manager", "hrd"]);
  const [rows, counts] = await Promise.all([
    db.select().from(divisions).where(eq(divisions.companyId, context.companyId)).orderBy(asc(divisions.name)),
    db.select({ name: employees.department, value: count() }).from(employees).where(eq(employees.companyId, context.companyId)).groupBy(employees.department),
  ]);
  const byName = new Map(counts.map((row) => [row.name, Number(row.value)]));
  return <DivisionManager initialRows={rows.map((row) => ({ ...row, employeeCount: byName.get(row.name) ?? 0 }))} canManage={["admin", "general_manager", "hrd"].includes(context.role)}/>;
}
