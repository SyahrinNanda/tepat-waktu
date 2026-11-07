import { and, asc, eq, gte, inArray, lte } from "drizzle-orm";
import { db } from "@/db";
import { buildPayslip, hoursBetween, monthRange, type Payslip, type PayslipLine, type PayslipSummary, type SalaryBasis } from "./payslip-calculation";
import {
  attendances,
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
const DEFAULT_WORK_WEEK = new Map([1, 2, 3, 4, 5].map((day) => [day, 8]));

type EmployeeRow = Payslip["employee"] & { baseSalary: number; overtimeRate: number; salaryBasis: SalaryBasis };
export type { Payslip, PayslipLine, PayslipSummary, SalaryBasis };





/**
 * Weekday (1 = Monday) -> scheduled hours, from the employee's division schedule or the company default.
 * Picks the schedule with the same rule as attendance (`resolveSchedule`): only active schedules count.
 */
async function workWeekFor(companyId: string, department: string) {
  const [assigned] = await db.select({ scheduleId: workSchedules.id }).from(divisions)
    .innerJoin(workSchedules, and(eq(workSchedules.id, divisions.scheduleId), eq(workSchedules.active, true)))
    .where(and(eq(divisions.companyId, companyId), eq(divisions.name, department), eq(divisions.active, true))).limit(1);
  let scheduleId = assigned?.scheduleId ?? null;
  if (!scheduleId) {
    const [fallback] = await db.select({ id: workSchedules.id }).from(workSchedules)
      .where(and(eq(workSchedules.companyId, companyId), eq(workSchedules.active, true))).orderBy(asc(workSchedules.createdAt), asc(workSchedules.id)).limit(1);
    scheduleId = fallback?.id ?? null;
  }
  if (!scheduleId) return DEFAULT_WORK_WEEK;
  const days = await db.select({ dayOfWeek: workScheduleDays.dayOfWeek, enabled: workScheduleDays.enabled, startTime: workScheduleDays.startTime, endTime: workScheduleDays.endTime })
    .from(workScheduleDays).where(eq(workScheduleDays.scheduleId, scheduleId));
  if (!days.length) return DEFAULT_WORK_WEEK;
  return new Map(days.filter((day) => day.enabled).map((day) => [day.dayOfWeek, hoursBetween(day.startTime, day.endTime) || 8]));
}

async function loadEmployee(companyId: string, employeeId: string): Promise<EmployeeRow | null> {
  const [row] = await db.select({
    id: employees.id, name: employees.name, employeeCode: employees.employeeCode, position: employees.position, department: employees.department,
    baseSalary: employeeSalaryProfiles.baseSalary, overtimeRate: employeeSalaryProfiles.overtimeRate, salaryBasis: employeeSalaryProfiles.salaryBasis,
  }).from(employees).leftJoin(employeeSalaryProfiles, eq(employeeSalaryProfiles.employeeId, employees.id))
    .where(and(eq(employees.id, employeeId), eq(employees.companyId, companyId))).limit(1);
  if (!row) return null;
  return { ...row, baseSalary: row.baseSalary ?? 0, overtimeRate: row.overtimeRate ?? 0, salaryBasis: row.salaryBasis ?? "monthly" };
}

/** Live calculation from salary settings, attendance, leave and overtime for one month. */
export async function calculatePayslip(companyId: string, employee: EmployeeRow, year: number, month: number): Promise<Payslip> {
  const { start, end } = monthRange(year, month);
  const [workWeek, attendanceRows, leaveRows, overtimeRows, components] = await Promise.all([
    workWeekFor(companyId, employee.department),
    db.select({ date: attendances.attendanceDate, status: attendances.status, checkIn: attendances.checkIn, checkOut: attendances.checkOut, breakStart: attendances.breakStart, breakEnd: attendances.breakEnd })
      .from(attendances).where(and(eq(attendances.companyId, companyId), eq(attendances.employeeId, employee.id), gte(attendances.attendanceDate, start), lte(attendances.attendanceDate, end))),
    db.select({ startDate: leaveRequests.startDate, endDate: leaveRequests.endDate, paid: leaveRequests.paid }).from(leaveRequests)
      .where(and(eq(leaveRequests.companyId, companyId), eq(leaveRequests.employeeId, employee.id), eq(leaveRequests.status, "approved"), lte(leaveRequests.startDate, end), gte(leaveRequests.endDate, start))),
    db.select({ minutes: overtimeRequests.durationMinutes }).from(overtimeRequests)
      .where(and(eq(overtimeRequests.companyId, companyId), eq(overtimeRequests.employeeId, employee.id), eq(overtimeRequests.status, "approved"), gte(overtimeRequests.overtimeDate, start), lte(overtimeRequests.overtimeDate, end))),
    db.select({ name: employeeSalaryComponents.name, type: employeeSalaryComponents.type, unit: employeeSalaryComponents.unit, amount: employeeSalaryComponents.amount })
      .from(employeeSalaryComponents).where(and(eq(employeeSalaryComponents.companyId, companyId), eq(employeeSalaryComponents.employeeId, employee.id))).orderBy(asc(employeeSalaryComponents.name)),
  ]);

  return buildPayslip({ employee, year, month, workWeek, attendanceRows, leaveRows, overtimeRows, components });
}

const summaryKeys: (keyof PayslipSummary)[] = ["workingDays", "daysWorked", "lateDays", "absentDays", "paidLeaveDays", "unpaidLeaveDays", "workedHours", "overtimeHours"];

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
