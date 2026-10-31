import type { Metadata } from "next";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { employeeDocuments, employeeLeaveEntitlements, employees, leaveRequests } from "@/db/schema";
import { LeaveReportManager } from "@/features/leave-reports/components/leave-report-manager";
import { requireCompanyRole } from "@/lib/current-company";

export const metadata: Metadata = { title: "Laporan Cuti Karyawan" };
export default async function Page({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  const context = await requireCompanyRole(["admin", "general_manager", "hrd", "manager"]);
  const input = Number((await searchParams).year), year = Number.isInteger(input) && input >= 2020 && input <= 2100 ? input : new Date().getFullYear();
  const [team, entitlements, requests] = await Promise.all([
    db.select({ id: employees.id, employeeCode: employees.employeeCode, name: employees.name, email: employees.email, department: employees.department, position: employees.position, status: employees.status, photoAssetId: employeeDocuments.assetId }).from(employees).leftJoin(employeeDocuments, and(eq(employeeDocuments.employeeId, employees.id), eq(employeeDocuments.kind, "profile_photo"))).where(eq(employees.companyId, context.companyId)).orderBy(asc(employees.name)),
    db.select({ employeeId: employeeLeaveEntitlements.employeeId, maximumDays: employeeLeaveEntitlements.maximumDays }).from(employeeLeaveEntitlements).where(and(eq(employeeLeaveEntitlements.companyId, context.companyId), eq(employeeLeaveEntitlements.year, year))),
    db.select({ employeeId: leaveRequests.employeeId, startDate: leaveRequests.startDate, endDate: leaveRequests.endDate }).from(leaveRequests).where(and(eq(leaveRequests.companyId, context.companyId), eq(leaveRequests.type, "annual"), eq(leaveRequests.status, "approved"))),
  ]);
  const maximumByEmployee = new Map(entitlements.map((item) => [item.employeeId, item.maximumDays]));
  const rows = team.map((person) => ({ ...person, maximumDays: maximumByEmployee.get(person.id) ?? 12, usedDays: requests.filter((request) => request.employeeId === person.id && request.startDate.slice(0, 4) === String(year)).reduce((sum, request) => sum + daysInYear(request.startDate, request.endDate, year), 0) }));
  return <LeaveReportManager initialRows={rows} year={year} canManage={["admin", "general_manager", "hrd"].includes(context.role)}/>;
}
function daysInYear(start: string, end: string, year: number) { const from = Math.max(Date.parse(`${start}T00:00:00Z`), Date.UTC(year, 0, 1)); const to = Math.min(Date.parse(`${end}T00:00:00Z`), Date.UTC(year, 11, 31)); return to < from ? 0 : Math.floor((to - from) / 86400000) + 1; }
