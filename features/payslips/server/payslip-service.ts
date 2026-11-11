import { and, asc, desc, eq, gte, inArray, lte } from "drizzle-orm";
import { db } from "@/db";
import { dateInTimeZone } from "@/lib/current-company";
import { buildPayslip, monthRange, weekday, type DayPlan, type Payslip, type PayslipLine, type PayslipSummary, type SalaryBasis } from "./payslip-calculation";
import { getPayrollRules } from "./payroll-settings";
import {
  attendances,
  companies,
  divisionSchedules,
  divisions,
  employeeSalaryComponents,
  employeeSalaryProfiles,
  employees,
  leaveRequests,
  overtimeRequests,
  payrollItems,
  payrolls,
  workScheduleDays,
  workSchedules,
} from "@/db/schema";

const FINAL = "Final";

type EmployeeRow = Payslip["employee"] & { baseSalary: number; overtimeRate: number; salaryBasis: SalaryBasis; joinedAt: string };
export type { Payslip, PayslipLine, PayslipSummary, SalaryBasis };

const DAY_NAMES = ["senin", "selasa", "rabu", "kamis", "jumat", "sabtu", "minggu"];
/** Working weekdays from a schedule's "work_days" text ("1,2,3,4,5", "Senin–Jumat", "Senin, Rabu"). */
export function parseWorkDays(text: string) {
  const value = text.toLowerCase().replace(/[’']/g, "");
  if (/^[\d,\s]+$/.test(value)) return new Set((value.match(/\d/g) ?? []).map(Number).filter((day) => day >= 1 && day <= 7));
  const named = DAY_NAMES.map((name, index) => (value.includes(name) ? index + 1 : 0)).filter(Boolean);
  if (named.length === 2 && /[–—-]|s\/d|sampai/.test(value)) {
    const [from, to] = named;
    return new Set(Array.from({ length: to - from + 1 }, (_, index) => from + index));
  }
  return new Set(named.length ? named : [1, 2, 3, 4, 5, 6, 7]);
}

/**
 * The employee's working plan per date, from the same schedules check-in uses (`resolveSchedule`):
 * the active schedules of the employee's active division in their order, else the company's oldest
 * active schedule, else Monday–Friday 08:00–17:00. A day is a working day when one of those schedules
 * works that weekday; a day already worked on a specific shift uses that shift's hours.
 * Per-weekday rows (Jam Kerja) override a schedule's times; without rows its "work_days" text applies.
 */
async function schedulePlanner(companyId: string, department: string, recordedScheduleIds: string[]) {
  const assigned = await db.select({ id: workSchedules.id }).from(divisions)
    .innerJoin(divisionSchedules, eq(divisionSchedules.divisionId, divisions.id))
    .innerJoin(workSchedules, and(eq(workSchedules.id, divisionSchedules.scheduleId), eq(workSchedules.active, true)))
    .where(and(eq(divisions.companyId, companyId), eq(divisions.name, department), eq(divisions.active, true)))
    .orderBy(asc(divisionSchedules.position), asc(workSchedules.name));
  let defaults = assigned.map((row) => row.id);
  if (!defaults.length) {
    const [fallback] = await db.select({ id: workSchedules.id }).from(workSchedules)
      .where(and(eq(workSchedules.companyId, companyId), eq(workSchedules.active, true))).orderBy(asc(workSchedules.createdAt), asc(workSchedules.id)).limit(1);
    defaults = fallback ? [fallback.id] : [];
  }
  const ids = [...new Set([...defaults, ...recordedScheduleIds])];
  const [schedules, days] = ids.length ? await Promise.all([
    db.select({ id: workSchedules.id, workDays: workSchedules.workDays, start: workSchedules.startTime, end: workSchedules.endTime }).from(workSchedules)
      .where(and(eq(workSchedules.companyId, companyId), inArray(workSchedules.id, ids))),
    db.select({ scheduleId: workScheduleDays.scheduleId, dayOfWeek: workScheduleDays.dayOfWeek, enabled: workScheduleDays.enabled, start: workScheduleDays.startTime, end: workScheduleDays.endTime })
      .from(workScheduleDays).where(inArray(workScheduleDays.scheduleId, ids)),
  ]) : [[], []];

  const weeks = new Map<string, Map<number, DayPlan>>();
  for (const schedule of schedules) {
    const rows = days.filter((day) => day.scheduleId === schedule.id);
    const workDays = parseWorkDays(schedule.workDays);
    weeks.set(schedule.id, new Map([1, 2, 3, 4, 5, 6, 7].map((dayOfWeek): [number, DayPlan] => {
      const row = rows.find((day) => day.dayOfWeek === dayOfWeek);
      if (row) return [dayOfWeek, row.enabled ? { start: row.start, end: row.end } : null];
      return [dayOfWeek, workDays.has(dayOfWeek) ? { start: schedule.start, end: schedule.end } : null];
    })));
  }
  const defaultWeeks = defaults.map((id) => weeks.get(id)).filter((week): week is Map<number, DayPlan> => Boolean(week));
  return (date: string, scheduleId: string | null): DayPlan => {
    const day = weekday(date);
    const recorded = scheduleId ? weeks.get(scheduleId) : undefined;
    if (recorded) return recorded.get(day) ?? null;
    if (!defaultWeeks.length) return day <= 5 ? { start: "08:00:00", end: "17:00:00" } : null;
    for (const week of defaultWeeks) { const plan = week.get(day); if (plan) return plan; }
    return null;
  };
}

async function loadEmployee(companyId: string, employeeId: string): Promise<EmployeeRow | null> {
  const [row] = await db.select({
    id: employees.id, name: employees.name, employeeCode: employees.employeeCode, position: employees.position, department: employees.department, joinedAt: employees.joinedAt,
    baseSalary: employeeSalaryProfiles.baseSalary, overtimeRate: employeeSalaryProfiles.overtimeRate, salaryBasis: employeeSalaryProfiles.salaryBasis,
  }).from(employees).leftJoin(employeeSalaryProfiles, eq(employeeSalaryProfiles.employeeId, employees.id))
    .where(and(eq(employees.id, employeeId), eq(employees.companyId, companyId))).limit(1);
  if (!row) return null;
  return { ...row, baseSalary: row.baseSalary ?? 0, overtimeRate: row.overtimeRate ?? 0, salaryBasis: row.salaryBasis ?? "monthly" };
}

/** Live calculation from salary settings, work schedules, attendance, leave and overtime for one month. */
export async function calculatePayslip(companyId: string, employee: EmployeeRow, year: number, month: number): Promise<Payslip> {
  const { start, end } = monthRange(year, month);
  const [attendanceRows, leaveRows, overtimeRows, components, rules, [company]] = await Promise.all([
    db.select({ date: attendances.attendanceDate, scheduleId: attendances.shiftId, status: attendances.status, checkIn: attendances.checkIn, checkOut: attendances.checkOut, breakStart: attendances.breakStart, breakEnd: attendances.breakEnd })
      .from(attendances).where(and(eq(attendances.companyId, companyId), eq(attendances.employeeId, employee.id), gte(attendances.attendanceDate, start), lte(attendances.attendanceDate, end))),
    db.select({ startDate: leaveRequests.startDate, endDate: leaveRequests.endDate, paid: leaveRequests.paid }).from(leaveRequests)
      .where(and(eq(leaveRequests.companyId, companyId), eq(leaveRequests.employeeId, employee.id), eq(leaveRequests.status, "approved"), lte(leaveRequests.startDate, end), gte(leaveRequests.endDate, start))),
    db.select({ minutes: overtimeRequests.durationMinutes }).from(overtimeRequests)
      .where(and(eq(overtimeRequests.companyId, companyId), eq(overtimeRequests.employeeId, employee.id), eq(overtimeRequests.status, "approved"), gte(overtimeRequests.overtimeDate, start), lte(overtimeRequests.overtimeDate, end))),
    db.select({ name: employeeSalaryComponents.name, type: employeeSalaryComponents.type, unit: employeeSalaryComponents.unit, amount: employeeSalaryComponents.amount })
      .from(employeeSalaryComponents).where(and(eq(employeeSalaryComponents.companyId, companyId), eq(employeeSalaryComponents.employeeId, employee.id))).orderBy(asc(employeeSalaryComponents.name)),
    getPayrollRules(companyId),
    db.select({ timezone: companies.timezone }).from(companies).where(eq(companies.id, companyId)).limit(1),
  ]);
  const planFor = await schedulePlanner(companyId, employee.department, attendanceRows.map((row) => row.scheduleId).filter((id): id is string => Boolean(id)));
  // Alpa only counts days that are over: from joining (or the 1st) up to yesterday; today may still check in.
  const today = dateInTimeZone(company?.timezone ?? "Asia/Jakarta");
  const absentFrom = employee.joinedAt > start ? employee.joinedAt : start;

  return buildPayslip({ employee, year, month, planFor, rules, absentFrom, absentBefore: today, attendanceRows, leaveRows, overtimeRows, components });
}

const summaryKeys: (keyof PayslipSummary)[] = ["workingDays", "daysWorked", "lateDays", "lateMinutes", "absentDays", "paidLeaveDays", "unpaidLeaveDays", "workedHours", "overtimeHours"];

async function finalSnapshot(companyId: string, employee: EmployeeRow, year: number, month: number): Promise<Payslip | null> {
  const [payroll] = await db.select().from(payrolls)
    .where(and(eq(payrolls.companyId, companyId), eq(payrolls.employeeId, employee.id), eq(payrolls.year, year), eq(payrolls.month, month), eq(payrolls.status, FINAL))).limit(1);
  if (!payroll) return null;
  const items = await db.select().from(payrollItems).where(eq(payrollItems.payrollId, payroll.id)).orderBy(asc(payrollItems.createdAt));
  const toLine = (item: typeof items[number]): PayslipLine => ({ name: item.name, quantity: item.quantity, unit: item.salaryType, rate: item.rate, amount: item.totalAmount });
  const summary = Object.fromEntries(summaryKeys.map((key) => [key, items.find((item) => item.category === "summary" && item.name === key)?.quantity ?? 0])) as PayslipSummary;
  return {
    employee: { id: employee.id, name: employee.name, employeeCode: employee.employeeCode, position: employee.position, department: employee.department },
    year, month, basis: (payroll.salaryType as SalaryBasis) ?? "monthly", baseRate: payroll.rate, summary,
    earnings: items.filter((item) => item.category === "compensation").map(toLine),
    deductions: items.filter((item) => item.category === "deduction").map(toLine),
    grossPay: payroll.compensationAmount, totalDeductions: payroll.deductionAmount, netPay: payroll.totalAmount,
    status: "final", finalizedAt: payroll.updatedAt.toISOString(),
  };
}

/** The locked snapshot when the month is finalized, otherwise a live draft. */
export async function getPayslip(companyId: string, employeeId: string, year: number, month: number) {
  const employee = await loadEmployee(companyId, employeeId);
  if (!employee) return null;
  return await finalSnapshot(companyId, employee, year, month) ?? calculatePayslip(companyId, employee, year, month);
}

export async function listPayslips(companyId: string, year: number, month: number) {
  const team = await db.select({ id: employees.id }).from(employees)
    .where(and(eq(employees.companyId, companyId), eq(employees.status, "active"))).orderBy(asc(employees.name));
  const slips = await Promise.all(team.map((row) => getPayslip(companyId, row.id, year, month)));
  return slips.filter((slip): slip is Payslip => slip !== null);
}

export async function finalizePayslips(companyId: string, employeeIds: string[], year: number, month: number, userId: string) {
  let count = 0;
  for (const employeeId of employeeIds) {
    const employee = await loadEmployee(companyId, employeeId);
    if (!employee || await finalSnapshot(companyId, employee, year, month)) continue;
    const slip = await calculatePayslip(companyId, employee, year, month);
    await db.transaction(async (tx) => {
      const [payroll] = await tx.insert(payrolls).values({
        companyId, employeeId, year, month, salaryType: slip.basis, quantity: 1, rate: slip.baseRate,
        compensationAmount: slip.grossPay, deductionAmount: slip.totalDeductions, totalAmount: slip.netPay, status: FINAL, createdBy: userId,
      }).returning({ id: payrolls.id });
      const lines = [
        ...slip.earnings.map((line) => ({ ...line, category: "compensation" })),
        ...slip.deductions.map((line) => ({ ...line, category: "deduction" })),
        ...summaryKeys.map((key) => ({ name: key, quantity: slip.summary[key], unit: "summary", rate: 0, amount: 0, category: "summary" })),
      ];
      await tx.insert(payrollItems).values(lines.map((line) => ({
        payrollId: payroll.id, companyId, category: line.category, name: line.name, rate: line.rate, quantity: line.quantity, salaryType: line.unit, totalAmount: line.amount,
      })));
    });
    count++;
  }
  return count;
}

export async function unlockPayslip(companyId: string, employeeId: string, year: number, month: number) {
  const rows = await db.select({ id: payrolls.id }).from(payrolls)
    .where(and(eq(payrolls.companyId, companyId), eq(payrolls.employeeId, employeeId), eq(payrolls.year, year), eq(payrolls.month, month), eq(payrolls.status, FINAL)));
  if (rows.length) await db.delete(payrolls).where(inArray(payrolls.id, rows.map((row) => row.id)));
  return rows.length;
}

/** Locked (published) payslip periods of one employee, newest first. Drafts are not shown to staff. */
export async function listFinalPeriods(companyId: string, employeeId: string) {
  return db.select({ year: payrolls.year, month: payrolls.month, netPay: payrolls.totalAmount, finalizedAt: payrolls.updatedAt }).from(payrolls)
    .where(and(eq(payrolls.companyId, companyId), eq(payrolls.employeeId, employeeId), eq(payrolls.status, FINAL)))
    .orderBy(desc(payrolls.year), desc(payrolls.month));
}

/** The locked payslip of one employee for a month, or null while it is still a draft. */
export async function getFinalPayslip(companyId: string, employeeId: string, year: number, month: number) {
  const employee = await loadEmployee(companyId, employeeId);
  return employee ? finalSnapshot(companyId, employee, year, month) : null;
}
