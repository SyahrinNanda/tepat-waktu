import type { Metadata } from "next";
import Link from "next/link";
import { and, asc, eq, ilike, or } from "drizzle-orm";
import { Ellipsis, Filter, Plus, Search } from "lucide-react";
import { db } from "@/db";
import { employeeDocuments, employees } from "@/db/schema";
import { EmployeeListTable } from "@/features/employees/components/employee-list-table";
import { employeeAccountStatuses } from "@/features/invitations/server/employee-account";
import { requireCompanyRole } from "@/lib/current-company";

export const metadata: Metadata = { title: "Daftar Karyawan" };
type Props = { searchParams: Promise<{ q?: string; status?: string }> };

export default async function Page({ searchParams }: Props) {
  const context = await requireCompanyRole(["admin", "general_manager", "hrd", "manager"]);
  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const status = params.status === "active" || params.status === "inactive" ? params.status : undefined;
  const rows = await db.select({
    id: employees.id, employeeCode: employees.employeeCode, name: employees.name, email: employees.email,
    department: employees.department, position: employees.position, status: employees.status,
    allAttendanceLocations: employees.allAttendanceLocations, contractType: employees.contractType,
    photoAssetId: employeeDocuments.assetId, lockLocation: employees.lockLocation,
    lockPhoto: employees.lockPhoto, userId: employees.userId,
  }).from(employees)
    .leftJoin(employeeDocuments, and(eq(employeeDocuments.employeeId, employees.id), eq(employeeDocuments.kind, "profile_photo")))
    .where(and(
      eq(employees.companyId, context.companyId),
      status ? eq(employees.status, status) : undefined,
      query ? or(ilike(employees.name, `%${query}%`), ilike(employees.email, `%${query}%`), ilike(employees.employeeCode, `%${query}%`), ilike(employees.department, `%${query}%`)) : undefined,
    )).orderBy(asc(employees.name));
  const canManage = ["admin", "general_manager", "hrd"].includes(context.role);
  const accounts = await employeeAccountStatuses(context.companyId, rows);
  // userId is only needed for the account status; it is not sent to the browser.
  const tableRows = rows.map((row) => {
    const rest: Omit<typeof row, "userId"> & { userId?: string | null } = { ...row };
    delete rest.userId;
    return { ...rest, account: accounts.get(row.id) ?? "none" };
  });
  return <>
    <div className="master-page-head"><span>Presensi Admin Panel</span><h1>Daftar Karyawan</h1></div>
    <section className="employee-list-card">
      <form className="employee-list-toolbar" method="get">
        <div className="master-search"><Search size={16}/><input name="q" defaultValue={query} placeholder="Nama Karyawan..."/></div>
        <select name="status" defaultValue={status ?? ""} aria-label="Status karyawan"><option value="">Semua Status</option><option value="active">Aktif</option><option value="inactive">Nonaktif</option></select>
        <button className="location-filter-button" type="submit"><Filter size={19}/> Filter</button><span/>
        {canManage && <Link className="btn btn-primary" href="/dashboard/karyawan/tambah"><Plus size={17}/> Tambah</Link>}
        <button className="master-reset" type="button" aria-label="Menu lainnya"><Ellipsis size={19}/></button>
      </form>
      <EmployeeListTable rows={tableRows} canManage={canManage}/>
      <div className="employee-list-footer">menampilkan {rows.length} data.</div>
    </section>
  </>;
}
