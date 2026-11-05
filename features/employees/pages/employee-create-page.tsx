import type { Metadata } from "next";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { divisions, jobPositions } from "@/db/schema";
import { EmployeeCreateForm } from "@/features/employees/components/employee-create-form";
import { dateInTimeZone, requireCompanyRole } from "@/lib/current-company";
import { employeeCapacity, employeeLimitMessage } from "@/features/subscriptions/server/employee-capacity";
import { EmployeeLimitNotice } from "@/features/employees/components/employee-limit-notice";

export const metadata: Metadata = { title: "Tambah Karyawan" };
export default async function Page() {
  const context = await requireCompanyRole(["admin", "general_manager", "hrd"]);
  const [divisionRows, positionRows, capacity] = await Promise.all([
    db.select({ id: divisions.id, name: divisions.name }).from(divisions).where(and(eq(divisions.companyId, context.companyId), eq(divisions.active, true))).orderBy(asc(divisions.name)),
    db.select({ id: jobPositions.id, name: jobPositions.name }).from(jobPositions).where(and(eq(jobPositions.companyId, context.companyId), eq(jobPositions.active, true))).orderBy(asc(jobPositions.name)),
    employeeCapacity(context.companyId),
  ]);
  return <><div className="master-page-head"><span>Presensi Admin Panel</span><h1>TAMBAH KARYAWAN</h1><p>Beranda / Karyawan / Tambah Karyawan</p></div>{capacity.full ? <EmployeeLimitNotice message={employeeLimitMessage(capacity)} canUpgrade={context.role === "admin"} /> : capacity.max !== null && <p className="employee-capacity-hint">Karyawan aktif: {capacity.active.toLocaleString("id-ID")} dari {capacity.max.toLocaleString("id-ID")} (paket {capacity.planName}).</p>}<EmployeeCreateForm divisions={divisionRows} positions={positionRows} today={dateInTimeZone(context.timezone)} disabled={capacity.full}/></>;
}
