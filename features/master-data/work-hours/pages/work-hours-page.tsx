import type { Metadata } from "next";
import { asc, eq, inArray } from "drizzle-orm";
import { WorkHoursManager } from "@/features/master-data/work-hours/components/work-hours-manager";
import { db } from "@/db";
import { workScheduleDays, workSchedules } from "@/db/schema";
import { requireCompanyRole } from "@/lib/current-company";

export const metadata: Metadata = { title: "Daftar Hari dan Waktu Kerja" };

export default async function Page() {
  const context=await requireCompanyRole(["admin","general_manager","hrd","manager"]);
  const shifts=await db.select().from(workSchedules).where(eq(workSchedules.companyId,context.companyId)).orderBy(asc(workSchedules.name));
  const days=shifts.length?await db.select().from(workScheduleDays).where(inArray(workScheduleDays.scheduleId,shifts.map(s=>s.id))).orderBy(asc(workScheduleDays.dayOfWeek)):[];
  return <WorkHoursManager shifts={shifts} initialDays={days} canManage={["admin","general_manager","hrd"].includes(context.role)}/>;
}
