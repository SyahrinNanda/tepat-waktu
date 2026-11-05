import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { divisions, employeeDocuments, employees, jobPositions } from "@/db/schema";
import { EmployeeEditForm } from "@/features/employees/components/employee-edit-form";
import { requireCompanyRole } from "@/lib/current-company";
import { employeeCapacity, employeeLimitMessage } from "@/features/subscriptions/server/employee-capacity";
import { EmployeeLimitNotice } from "@/features/employees/components/employee-limit-notice";

export const metadata: Metadata = { title: "Edit Karyawan" };
export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ limit?: string }> }) {
  const { id } = await params;
  const { limit } = await searchParams;
  const context = await requireCompanyRole(["admin", "general_manager", "hrd"]);
  const [[employee], divisionRows, positionRows, documentRows] = await Promise.all([
    db.select().from(employees).where(and(eq(employees.id, id), eq(employees.companyId, context.companyId))).limit(1),
    db.select({ id: divisions.id, name: divisions.name }).from(divisions).where(and(eq(divisions.companyId, context.companyId), eq(divisions.active, true))).orderBy(asc(divisions.name)),
    db.select({ id: jobPositions.id, name: jobPositions.name }).from(jobPositions).where(and(eq(jobPositions.companyId, context.companyId), eq(jobPositions.active, true))).orderBy(asc(jobPositions.name)),
    db.select({ kind: employeeDocuments.kind, assetId: employeeDocuments.assetId }).from(employeeDocuments).where(eq(employeeDocuments.employeeId, id)),
  ]);
  if (!employee) notFound();
  const capacity = limit ? await employeeCapacity(context.companyId, undefined, { excludeEmployeeId: employee.id }) : null;
  const documents = Object.fromEntries(documentRows.map((row) => [row.kind, row.assetId]));
  return <><div className="master-page-head"><span>Presensi Admin Panel</span><h1>EDIT KARYAWAN</h1><p>Beranda / Karyawan / Edit Karyawan</p></div>{capacity?.full && <EmployeeLimitNotice message={`Karyawan ini belum bisa diaktifkan kembali. ${employeeLimitMessage(capacity)}`} canUpgrade={context.role === "admin"} />}<EmployeeEditForm employee={employee} divisions={divisionRows} positions={positionRows} documents={documents}/></>;
}
