import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { employees, leaveRequests } from "@/db/schema";
import { LeaveRequestManager } from "@/features/leave-requests/components/leave-request-manager";
import { dateInTimeZone, requireCompany } from "@/lib/current-company";

export async function LeaveRequestModule() {
  const context = await requireCompany();
  const canReview = ["admin", "owner", "general_manager", "hrd"].includes(context.role);
  const [team, rows] = await Promise.all([
    db.select({ id: employees.id, name: employees.name, employeeCode: employees.employeeCode, department: employees.department }).from(employees)
      .where(and(eq(employees.companyId, context.companyId), eq(employees.status, "active"), canReview ? undefined : eq(employees.userId, context.session.user.id))).orderBy(asc(employees.name)),
    db.select({ id: leaveRequests.id, employeeId: employees.id, name: employees.name, employeeCode: employees.employeeCode, department: employees.department, type: leaveRequests.type, startDate: leaveRequests.startDate, endDate: leaveRequests.endDate, reason: leaveRequests.reason, status: leaveRequests.status, paid: leaveRequests.paid, createdAt: leaveRequests.createdAt })
      .from(leaveRequests).innerJoin(employees, eq(leaveRequests.employeeId, employees.id))
      .where(and(eq(leaveRequests.companyId, context.companyId), canReview ? undefined : eq(employees.userId, context.session.user.id))).orderBy(desc(leaveRequests.createdAt)),
  ]);
  return <LeaveRequestManager initialRows={rows} employees={team} canReview={canReview} today={dateInTimeZone(context.timezone)}/>;
}
