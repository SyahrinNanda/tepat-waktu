import type { Metadata } from "next";
import { asc, eq } from "drizzle-orm";
import { ShiftManager } from "@/features/master-data/shifts/components/shift-manager";
import { db } from "@/db";
import { workSchedules } from "@/db/schema";
import { requireCompanyRole } from "@/lib/current-company";

export const metadata: Metadata = { title: "Daftar Shift" };

export default async function Page() {
  const context=await requireCompanyRole(["admin","general_manager","hrd","manager"]);
  const rows=await db.select().from(workSchedules).where(eq(workSchedules.companyId,context.companyId)).orderBy(asc(workSchedules.name));
  return <ShiftManager initialRows={rows} canManage={["admin","general_manager","hrd"].includes(context.role)}/>;
}
