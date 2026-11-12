import type { Metadata } from "next";
import { and, asc, eq, gte, lte } from "drizzle-orm";
import { db } from "@/db";
import { employeeDocuments, employees, leaveRequests } from "@/db/schema";
import { LeaveReportManager, type LeaveReportRow, type LeaveTally } from "@/features/leave-reports/components/leave-report-manager";
import { annualLeaveBalances, getLeaveRules, workDayCounter } from "@/features/leave-requests/server/annual-balance";
import { dateInTimeZone, requireCompanyRole } from "@/lib/current-company";

export const metadata: Metadata = { title: "Laporan Cuti Karyawan" };

const isDate = (value?: string) => Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)));

export default async function Page({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const context = await requireCompanyRole(["admin", "general_manager", "hrd", "manager"]);
  const query = await searchParams;
  const today = dateInTimeZone(context.timezone);
  // Rekap period: from–to of the filter (default: this calendar year).
  let from = isDate(query.from) ? query.from! : `${today.slice(0, 4)}-01-01`, to = isDate(query.to) ? query.to! : `${today.slice(0, 4)}-12-31`;
  if (from > to) [from, to] = [to, from];

  const counter = workDayCounter(context.companyId);
  const [team, rules, balances, requests] = await Promise.all([
    db.select({ id: employees.id, employeeCode: employees.employeeCode, name: employees.name, email: employees.email, department: employees.department, position: employees.position, status: employees.status, joinedAt: employees.joinedAt, photoAssetId: employeeDocuments.assetId })
      .from(employees).leftJoin(employeeDocuments, and(eq(employeeDocuments.employeeId, employees.id), eq(employeeDocuments.kind, "profile_photo")))
      .where(eq(employees.companyId, context.companyId)).orderBy(asc(employees.name)),
    getLeaveRules(context.companyId),
    annualLeaveBalances(context.companyId, today, { counter }),
    // Approved requests overlapping the rekap period.
    db.select({ employeeId: leaveRequests.employeeId, type: leaveRequests.type, name: leaveRequests.specialLeaveName, startDate: leaveRequests.startDate, endDate: leaveRequests.endDate, workDays: leaveRequests.workDays })
      .from(leaveRequests).where(and(eq(leaveRequests.companyId, context.companyId), eq(leaveRequests.status, "approved"), lte(leaveRequests.startDate, to), gte(leaveRequests.endDate, from))),
  ]);

  const departments = new Map(team.map((person) => [person.id, person.department]));
  const tallies = new Map<string, { annual: LeaveTally; sick: LeaveTally; permission: LeaveTally; special: Map<string, LeaveTally & { name: string }> }>();
  for (const request of requests) {
    const department = departments.get(request.employeeId);
    if (department === undefined) continue;
    const start = request.startDate < from ? from : request.startDate, end = request.endDate > to ? to : request.endDate;
    // Working days inside the rekap period (the stored count when the whole request is inside it).
    const days = start === request.startDate && end === request.endDate && request.workDays != null ? request.workDays : await counter(department, start, end);
    const entry = tallies.get(request.employeeId) ?? { annual: { times: 0, days: 0 }, sick: { times: 0, days: 0 }, permission: { times: 0, days: 0 }, special: new Map() };
    if (request.type === "special") {
      const name = request.name ?? "Cuti Khusus", kind = entry.special.get(name) ?? { name, times: 0, days: 0 };
      kind.times += 1; kind.days += days; entry.special.set(name, kind);
    } else { entry[request.type].times += 1; entry[request.type].days += days; }
    tallies.set(request.employeeId, entry);
  }

  const rows: LeaveReportRow[] = team.map((person) => {
    const tally = tallies.get(person.id);
    return {
      ...person, balance: balances.get(person.id)!,
      annual: tally?.annual ?? { times: 0, days: 0 }, sick: tally?.sick ?? { times: 0, days: 0 }, permission: tally?.permission ?? { times: 0, days: 0 },
      special: [...(tally?.special.values() ?? [])].sort((a, b) => a.name.localeCompare(b.name, "id")),
    };
  });
  return <LeaveReportManager initialRows={rows} rules={rules} from={from} to={to} today={today} canManage={["admin", "general_manager", "hrd"].includes(context.role)}/>;
}
