import type { Metadata } from "next";
import { asc, count, eq } from "drizzle-orm";
import { DivisionManager } from "@/features/master-data/divisions/components/division-manager";
import { listDivisionsWithSchedules } from "@/features/master-data/divisions/server/division-schedules";
import { db } from "@/db";
import { employees, workSchedules } from "@/db/schema";
import { requireCompanyRole } from "@/lib/current-company";

export const metadata: Metadata = { title: "Daftar Divisi" };

export default async function Page() {
  const context=await requireCompanyRole(["admin","general_manager","hrd","manager"]);
  const [rows,shifts,counts]=await Promise.all([
    listDivisionsWithSchedules(context.companyId),
    db.select().from(workSchedules).where(eq(workSchedules.companyId,context.companyId)).orderBy(asc(workSchedules.name)),
    db.select({name:employees.department,value:count()}).from(employees).where(eq(employees.companyId,context.companyId)).groupBy(employees.department),
  ]);
  const byName=new Map(counts.map(row=>[row.name,Number(row.value)]));
  return <DivisionManager initialRows={rows.map(row=>({...row,employeeCount:byName.get(row.name)??0}))} shifts={shifts} canManage={["admin","general_manager","hrd"].includes(context.role)}/>;
}
