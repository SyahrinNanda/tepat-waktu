import { and, eq, inArray, ne } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { companies, employeeLeaveEntitlements, employees, leaveRequests } from "@/db/schema";
import { schedulePlanner } from "@/features/payslips/server/payslip-service";
import { featureContext } from "@/features/generic-modules/server/feature-records";
import { reviewerRoles } from "./schemas";
import { annualLeaveBalance, DEFAULT_LEAVE_RULES, leavePeriodFor, LEAVE_ELIGIBILITY, shiftDate, type AnnualLeaveBalance, type AnnualLeaveRules, type LeaveEligibility } from "@/features/leave-requests/annual-leave";

export async function getLeaveRules(companyId: string): Promise<AnnualLeaveRules> {
  const [row] = await db.select({ days: companies.annualLeaveDays, eligibility: companies.annualLeaveEligibility, carryOver: companies.annualLeaveCarryOver, carryOverMax: companies.annualLeaveCarryOverMax })
    .from(companies).where(eq(companies.id, companyId)).limit(1);
  if (!row) return DEFAULT_LEAVE_RULES;
  return { ...row, eligibility: (LEAVE_ELIGIBILITY as readonly string[]).includes(row.eligibility) ? row.eligibility as LeaveEligibility : "immediate" };
}

/** Counts an employee's working days (their division schedule) in a date range; planners are cached per division. */
export function workDayCounter(companyId: string) {
  const planners = new Map<string, Promise<(date: string, scheduleId: string | null) => unknown>>();
  return async (department: string, start: string, end: string) => {
    if (!planners.has(department)) planners.set(department, schedulePlanner(companyId, department, []));
    const planFor = await planners.get(department)!;
    let days = 0;
    for (let day = start, guard = 0; day <= end && guard < 800; day = shiftDate(day, 1), guard++) if (planFor(day, null) !== null) days++;
    return days;
  };
}

type Counter = ReturnType<typeof workDayCounter>;

/** Cuti Tahunan balances of several employees, each in the period containing `asOf`. */
export async function annualLeaveBalances(companyId: string, asOf: string, options: { employeeIds?: string[]; excludeRequestId?: string; counter?: Counter; rules?: AnnualLeaveRules } = {}) {
  const employeeFilter = options.employeeIds ? inArray(employees.id, options.employeeIds) : undefined;
  if (options.employeeIds && !options.employeeIds.length) return new Map<string, AnnualLeaveBalance>();
  const [rules, team, overrides, requests] = await Promise.all([
    options.rules ?? getLeaveRules(companyId),
    db.select({ id: employees.id, joinedAt: employees.joinedAt, department: employees.department }).from(employees).where(and(eq(employees.companyId, companyId), employeeFilter)),
    db.select({ employeeId: employeeLeaveEntitlements.employeeId, year: employeeLeaveEntitlements.year, days: employeeLeaveEntitlements.maximumDays }).from(employeeLeaveEntitlements)
      .where(and(eq(employeeLeaveEntitlements.companyId, companyId), options.employeeIds ? inArray(employeeLeaveEntitlements.employeeId, options.employeeIds) : undefined)),
    db.select({ id: leaveRequests.id, employeeId: leaveRequests.employeeId, startDate: leaveRequests.startDate, endDate: leaveRequests.endDate, workDays: leaveRequests.workDays, status: leaveRequests.status }).from(leaveRequests)
      .where(and(eq(leaveRequests.companyId, companyId), eq(leaveRequests.type, "annual"), ne(leaveRequests.status, "rejected"),
        options.employeeIds ? inArray(leaveRequests.employeeId, options.employeeIds) : undefined, options.excludeRequestId ? ne(leaveRequests.id, options.excludeRequestId) : undefined)),
  ]);
  const counter = options.counter ?? workDayCounter(companyId);
  const departments = new Map(team.map((person) => [person.id, person.department]));
  const overridesByEmployee = new Map<string, Map<number, number>>();
  for (const item of overrides) overridesByEmployee.set(item.employeeId, (overridesByEmployee.get(item.employeeId) ?? new Map()).set(item.year, item.days));
  const requestsByEmployee = new Map<string, { startDate: string; workDays: number; status: "pending" | "approved" | "rejected" }[]>();
  for (const request of requests) {
    const department = departments.get(request.employeeId);
    if (department === undefined) continue;
    // Requests saved before working days were stored are counted against the schedule now.
    const workDays = request.workDays ?? await counter(department, request.startDate, request.endDate);
    requestsByEmployee.set(request.employeeId, [...(requestsByEmployee.get(request.employeeId) ?? []), { startDate: request.startDate, workDays, status: request.status }]);
  }
  return new Map(team.map((person) => [person.id, annualLeaveBalance({ rules, joinedAt: person.joinedAt, asOf, requests: requestsByEmployee.get(person.id) ?? [], overrides: overridesByEmployee.get(person.id) })]));
}

const formatDate = (value: string) => new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));

export type AnnualLeaveCheck =
  | { ok: true; workDays: number; balance: AnnualLeaveBalance }
  | { ok: false; error: string; workDays?: number; balance?: AnnualLeaveBalance };

/**
 * Validates a Cuti Tahunan request: working days in the range, inside one leave period, and within the
 * days still available in that period (pending requests count too). `excludeRequestId` = the request being edited.
 */
export async function checkAnnualLeave(companyId: string, input: { employeeId: string; startDate: string; endDate: string }, excludeRequestId?: string): Promise<AnnualLeaveCheck> {
  if (input.endDate < input.startDate) return { ok: false, error: "Tanggal selesai tidak boleh sebelum tanggal mulai." };
  const [employee] = await db.select({ joinedAt: employees.joinedAt, department: employees.department }).from(employees)
    .where(and(eq(employees.id, input.employeeId), eq(employees.companyId, companyId))).limit(1);
  if (!employee) return { ok: false, error: "Karyawan tidak ditemukan." };
  const counter = workDayCounter(companyId);
  const [workDays, balances] = await Promise.all([
    counter(employee.department, input.startDate, input.endDate),
    annualLeaveBalances(companyId, input.startDate, { employeeIds: [input.employeeId], excludeRequestId, counter }),
  ]);
  const balance = balances.get(input.employeeId)!;
  if (!workDays) return { ok: false, error: "Tanggal yang dipilih bukan hari kerja karyawan ini.", workDays, balance };
  const period = leavePeriodFor(employee.joinedAt, input.startDate);
  if (input.endDate > period.end) return { ok: false, error: `Cuti melewati tanggal reset jatah (${formatDate(period.nextReset)}). Pisahkan menjadi dua pengajuan: sampai ${formatDate(period.end)} dan mulai ${formatDate(period.nextReset)}.`, workDays, balance };
  if (!balance.eligible) return { ok: false, error: `Belum berhak cuti tahunan. Hak cuti mulai ${formatDate(balance.eligibleFrom)} (setelah 12 bulan kerja).`, workDays, balance };
  if (workDays > balance.available) {
    const pendingNote = balance.pending ? ` (${balance.pending} hari masih menunggu persetujuan)` : "";
    return { ok: false, error: `Sisa cuti tahunan tidak cukup: tersedia ${Math.max(balance.available, 0)} hari kerja${pendingNote}, diajukan ${workDays} hari kerja. Jatah direset ${formatDate(balance.nextReset)}.`, workDays, balance };
  }
  return { ok: true, workDays, balance };
}

const balanceQuery = z.object({ employeeId: z.uuid(), startDate: z.iso.date().optional(), endDate: z.iso.date().optional(), excludeId: z.uuid().optional() });

/**
 * POST /api/leave-requests/annual-balance: the employee's Cuti Tahunan balance (today, or for the period of
 * startDate) and, with both dates, the same check that runs when the request is saved.
 */
export async function previewAnnualLeave(request: Request) {
  const context = await featureContext(request, "pengajuan/izin-cuti", "read");
  if ("error" in context) return context.error;
  const parsed = balanceQuery.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Data tidak valid." }, { status: 400 });
  const input = parsed.data;
  if (!reviewerRoles.includes(context.role)) {
    const [own] = await db.select({ id: employees.id }).from(employees).where(and(eq(employees.id, input.employeeId), eq(employees.companyId, context.companyId), eq(employees.userId, context.userId))).limit(1);
    if (!own) return Response.json({ error: "Karyawan tidak dapat dipilih." }, { status: 403 });
  }
  if (input.startDate && input.endDate) return Response.json(await checkAnnualLeave(context.companyId, { employeeId: input.employeeId, startDate: input.startDate, endDate: input.endDate }, input.excludeId));
  const [company] = await db.select({ timezone: companies.timezone }).from(companies).where(eq(companies.id, context.companyId)).limit(1);
  const asOf = input.startDate ?? new Intl.DateTimeFormat("en-CA", { timeZone: company?.timezone ?? "Asia/Jakarta" }).format(new Date());
  const balance = (await annualLeaveBalances(context.companyId, asOf, { employeeIds: [input.employeeId], excludeRequestId: input.excludeId })).get(input.employeeId);
  return balance ? Response.json({ ok: true, balance }) : Response.json({ error: "Karyawan tidak ditemukan." }, { status: 404 });
}
