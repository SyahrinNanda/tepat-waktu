import type { Metadata } from "next";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { divisions, jobPositions } from "@/db/schema";
import { EmployeeCreateForm } from "@/features/employees/components/employee-create-form";
import { dateInTimeZone, requireCompanyRole } from "@/lib/current-company";

export const metadata: Metadata = { title: "Tambah Karyawan" };
export default async function Page() {
  const context = await requireCompanyRole(["admin", "general_manager", "hrd"]);
  const [divisionRows, positionRows] = await Promise.all([
    db.select({ id: divisions.id, name: divisions.name }).from(divisions).where(and(eq(divisions.companyId, context.companyId), eq(divisions.active, true))).orderBy(asc(divisions.name)),
    db.select({ id: jobPositions.id, name: jobPositions.name }).from(jobPositions).where(and(eq(jobPositions.companyId, context.companyId), eq(jobPositions.active, true))).orderBy(asc(jobPositions.name)),
  ]);
  return <><div className="master-page-head"><span>Presensi Admin Panel</span><h1>TAMBAH KARYAWAN</h1><p>Beranda / Karyawan / Tambah Karyawan</p></div><EmployeeCreateForm divisions={divisionRows} positions={positionRows} today={dateInTimeZone(context.timezone)}/></>;
}
