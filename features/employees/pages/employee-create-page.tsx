import type { Metadata } from "next";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { positions, divisions } from "@/db/schema";
import { EmployeeCreateForm } from "@/features/employees/components/employee-create-form";
import { dateInTimeZone, requireCompanyRole } from "@/lib/current-company";
import { employeeCapacity, employeeLimitMessage } from "@/features/subscriptions/server/employee-capacity";
import { EmployeeLimitNotice } from "@/features/employees/components/employee-limit-notice";
import { activeLocationOptions } from "@/features/employees/server/employee-locations";

export const metadata: Metadata = { title: "Tambah Karyawan" };
export default async function Page() {
  const context = await requireCompanyRole(["admin", "general_manager", "hrd"]);
  const [positionRows, divisionRows, capacity, locationRows] = await Promise.all([
    db.select({ id: positions.id, name: positions.name }).from(positions).where(and(eq(positions.companyId, context.companyId), eq(positions.active, true))).orderBy(asc(positions.name)),
    db.select({ id: divisions.id, name: divisions.name }).from(divisions).where(and(eq(divisions.companyId, context.companyId), eq(divisions.active, true))).orderBy(asc(divisions.name)),
    employeeCapacity(context.companyId),
    activeLocationOptions(context.companyId),
  ]);
  return <><div className="master-page-head"><span>Panel Admin</span><h1>TAMBAH KARYAWAN</h1><p>Beranda / Karyawan / Tambah Karyawan</p></div>{capacity.full ? <EmployeeLimitNotice message={employeeLimitMessage(capacity)} canUpgrade={context.role === "admin"} /> : capacity.max !== null && <p className="employee-capacity-hint">Karyawan aktif: {capacity.active.toLocaleString("id-ID")} dari {capacity.max.toLocaleString("id-ID")} (paket {capacity.planName}).</p>}<EmployeeCreateForm positions={positionRows} divisions={divisionRows} locations={locationRows} today={dateInTimeZone(context.timezone)} disabled={capacity.full}/></>;
}
