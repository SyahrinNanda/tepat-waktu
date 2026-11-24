import type { Metadata } from "next";
import { asc, count, eq } from "drizzle-orm";
import { PositionManager } from "@/features/master-data/positions/components/position-manager";
import { listPositionsWithSchedules } from "@/features/master-data/positions/server/position-schedules";
import { db } from "@/db";
import { employees, workSchedules } from "@/db/schema";
import { requireCompanyRole } from "@/lib/current-company";

export const metadata: Metadata = { title: "Daftar Jabatan" };

export default async function Page() {
  const context=await requireCompanyRole(["admin", "general_manager", "hrd"]);
  const [rows,shifts,counts]=await Promise.all([
    listPositionsWithSchedules(context.companyId),
    db.select().from(workSchedules).where(eq(workSchedules.companyId,context.companyId)).orderBy(asc(workSchedules.name)),
    db.select({name:employees.position,value:count()}).from(employees).where(eq(employees.companyId,context.companyId)).groupBy(employees.position),
  ]);
  const byName=new Map(counts.map(row=>[row.name,Number(row.value)]));
  return <PositionManager initialRows={rows.map(row=>({...row,employeeCount:byName.get(row.name)??0}))} shifts={shifts} canManage={["admin","general_manager","hrd"].includes(context.role)}/>;
}
