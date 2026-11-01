import type { Metadata } from "next";
import { asc, count, eq } from "drizzle-orm";
import { DivisionManager } from "@/features/master-data/divisions/components/division-manager";
import { db } from "@/db";
import { divisions, employees, workSchedules } from "@/db/schema";
import { requireCompanyRole } from "@/lib/current-company";

export const metadata: Metadata = { title: "Daftar Divisi" };

export default async function Page() {
  const context=await requireCompanyRole(["admin","general_manager","hrd","manager"]);
  const [rows,shifts,counts]=await Promise.all([
    db.select({id:divisions.id,name:divisions.name,scheduleId:divisions.scheduleId,shiftName:workSchedules.name,active:divisions.active}).from(divisions).leftJoin(workSchedules,eq(divisions.scheduleId,workSchedules.id)).where(eq(divisions.companyId,context.companyId)).orderBy(asc(divisions.name)),
    db.select().from(workSchedules).where(eq(workSchedules.companyId,context.companyId)).orderBy(asc(workSchedules.name)),
    db.select({name:employees.department,value:count()}).from(employees).where(eq(employees.companyId,context.companyId)).groupBy(employees.department),
  ]);
  const byName=new Map(counts.map(row=>[row.name,Number(row.value)]));
  return <DivisionManager initialRows={rows.map(row=>({...row,employeeCount:byName.get(row.name)??0}))} shifts={shifts} canManage={["admin","general_manager","hrd"].includes(context.role)}/>;
}
