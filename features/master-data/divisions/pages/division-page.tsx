import type { Metadata } from "next";
import { asc, count, eq } from "drizzle-orm";
import { db } from "@/db";
import { employees, jobPositions } from "@/db/schema";
import { PositionManager } from "@/features/master-data/positions/components/position-manager";
import { requireCompanyRole } from "@/lib/current-company";

export const metadata: Metadata = { title: "Daftar Jabatan" };
export default async function Page() {
  const context = await requireCompanyRole(["admin", "general_manager", "hrd", "manager"]);
  const [rows, counts] = await Promise.all([
    db.select().from(jobPositions).where(eq(jobPositions.companyId, context.companyId)).orderBy(asc(jobPositions.name)),
    db.select({ name: employees.position, value: count() }).from(employees).where(eq(employees.companyId, context.companyId)).groupBy(employees.position),
  ]);
  const byName = new Map(counts.map((row) => [row.name, Number(row.value)]));
  return <PositionManager initialRows={rows.map((row) => ({ ...row, employeeCount: byName.get(row.name) ?? 0 }))} canManage={["admin", "general_manager", "hrd"].includes(context.role)}/>;
}
