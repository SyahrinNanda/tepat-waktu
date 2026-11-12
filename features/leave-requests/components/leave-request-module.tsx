import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { employees, leaveRequests } from "@/db/schema";
import { LeaveRequestManager } from "@/features/leave-requests/components/leave-request-manager";
import { listSpecialLeaveTypes } from "@/features/leave-requests/server/special-types";
import { annualLeaveBalances } from "@/features/leave-requests/server/annual-balance";
import { dateInTimeZone, requireCompany } from "@/lib/current-company";

export async function LeaveRequestModule() {
  const context = await requireCompany();
  const canReview = ["admin", "owner", "general_manager", "hrd"].includes(context.role);
  const [team, rows, specialTypes] = await Promise.all([
    db.select({ id: employees.id, name: employees.name, employeeCode: employees.employeeCode, department: employees.department }).from(employees)
      .where(and(eq(employees.companyId, context.companyId), eq(employees.status, "active"), canReview ? undefined : eq(employees.userId, context.session.user.id))).orderBy(asc(employees.name)),
    db.select({ id: leaveRequests.id, employeeId: employees.id, name: employees.name, employeeCode: employees.employeeCode, department: employees.department, type: leaveRequests.type, specialLeaveTypeId: leaveRequests.specialLeaveTypeId, specialLeaveName: leaveRequests.specialLeaveName, workDays: leaveRequests.workDays, startDate: leaveRequests.startDate, endDate: leaveRequests.endDate, reason: leaveRequests.reason, status: leaveRequests.status, paid: leaveRequests.paid, createdAt: leaveRequests.createdAt })
      .from(leaveRequests).innerJoin(employees, eq(leaveRequests.employeeId, employees.id))
      .where(and(eq(leaveRequests.companyId, context.companyId), canReview ? undefined : eq(employees.userId, context.session.user.id))).orderBy(desc(leaveRequests.createdAt)),
    listSpecialLeaveTypes(context.companyId),
  ]);
  const today = dateInTimeZone(context.timezone);
  // Employees see their own Cuti Tahunan balance above their requests.
  const own = !canReview && team.length === 1 ? (await annualLeaveBalances(context.companyId, today, { employeeIds: [team[0].id] })).get(team[0].id) ?? null : null;
  return <LeaveRequestManager initialRows={rows} employees={team} canReview={canReview} specialTypes={specialTypes} today={today} ownBalance={own}/>;
}
