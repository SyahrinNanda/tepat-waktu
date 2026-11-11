// Pure payslip arithmetic (no database access) so the rules can be reasoned about and tested.

export type SalaryBasis = "hourly" | "daily" | "monthly";
export type PayslipLine = { name: string; quantity: number; unit: string; rate: number; amount: number };
export type PayslipSummary = {
  workingDays: number;
  daysWorked: number;
  lateDays: number;
  lateMinutes: number;
  /** Past days with a check-in but no check-out, counted until the scheduled end time. */
  missingCheckouts: number;
  absentDays: number;
  paidLeaveDays: number;
  unpaidLeaveDays: number;
  workedHours: number;
  overtimeHours: number;
};
export type Payslip = {
  employee: { id: string; name: string; employeeCode: string; position: string; department: string };
  year: number;
  month: number;
  basis: SalaryBasis;
  baseRate: number;
  summary: PayslipSummary;
  earnings: PayslipLine[];
  deductions: PayslipLine[];
  grossPay: number;
  totalDeductions: number;
  netPay: number;
  status: "draft" | "final";
  finalizedAt: string | null;
};

export const basisLabels: Record<SalaryBasis, string> = { hourly: "Per Jam", daily: "Per Hari", monthly: "Per Bulan" };

export type LateDeductionMode = "none" | "per_day" | "per_hour" | "per_minute";
export type AbsentDeductionMode = "daily_rate" | "fixed" | "none";
/** A company's payslip rules (see payroll_settings). */
export type PayrollRules = {
  breakMinutes: number;
  breakMinWorkMinutes: number;
  lateDeductionMode: LateDeductionMode;
  lateDeductionAmount: number;
  absentDeductionMode: AbsentDeductionMode;
  absentDeductionAmount: number;
};
export const DEFAULT_PAYROLL_RULES: PayrollRules = {
  breakMinutes: 60, breakMinWorkMinutes: 240, lateDeductionMode: "none", lateDeductionAmount: 0, absentDeductionMode: "daily_rate", absentDeductionAmount: 0,
};

/** Scheduled hours of one day ("HH:MM:SS"), or null on a day off. */
export type DayPlan = { start: string; end: string } | null;

export type CalculationEmployee = Payslip["employee"] & { baseSalary: number; overtimeRate: number; salaryBasis: SalaryBasis };
export type CalculationInput = {
  employee: CalculationEmployee;
  year: number;
  month: number;
  /**
   * The employee's schedule for a date. `scheduleId` is the schedule recorded at check-in (a division
   * may have several shifts); null asks for the division's default plan of that weekday.
   */
  planFor: (date: string, scheduleId: string | null) => DayPlan;
  rules: PayrollRules;
  /**
   * Working days in [absentFrom, absentBefore) without attendance or leave count as alpa; a check-in
   * before absentBefore without check-out counts until the scheduled end. absentBefore is today.
   */
  absentFrom: string;
  absentBefore: string;
  attendanceRows: { date: string; scheduleId: string | null; status: "present" | "late" | "absent" | "leave"; checkIn: string | null; checkOut: string | null; breakStart: string | null; breakEnd: string | null }[];
  leaveRows: { startDate: string; endDate: string; paid: boolean }[];
  overtimeRows: { minutes: number }[];
  components: { name: string; type: "compensation" | "deduction"; unit: "hour" | "day" | "month"; amount: number }[];
};

export function monthRange(year: number, month: number) {
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const end = `${year}-${String(month).padStart(2, "0")}-${String(days).padStart(2, "0")}`;
  const dates = Array.from({ length: days }, (_, index) => `${start.slice(0, 8)}${String(index + 1).padStart(2, "0")}`);
  return { start, end, dates };
}

export function weekday(date: string) {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return day === 0 ? 7 : day;
}

const clock = (value: string) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5));

/** Minutes from start to end on the same day (0 when missing or reversed). */
export function minutesBetween(start: string | null, end: string | null) {
  if (!start || !end) return 0;
  return Math.max(0, clock(end) - clock(start));
}

export function hoursBetween(start: string | null, end: string | null) {
  return minutesBetween(start, end) / 60;
}

/** Break taken on a worked day: the recorded break, else the company break when the day is long enough. */
export function breakMinutesFor(spanMinutes: number, recorded: number, rules: PayrollRules) {
  if (recorded > 0) return Math.min(recorded, spanMinutes);
  return spanMinutes > rules.breakMinWorkMinutes ? Math.min(rules.breakMinutes, spanMinutes) : 0;
}

/** Paid working minutes of a scheduled day (shift length minus the company break; overnight shifts wrap). */
export function plannedMinutes(plan: DayPlan, rules: PayrollRules) {
  if (!plan) return 0;
  let span = clock(plan.end) - clock(plan.start);
  if (span <= 0) span += 1440;
  return span - breakMinutesFor(span, 0, rules);
}

/** Decimal hours as "1 jam 20 menit" (payslips show minutes, not fractions of an hour). */
export function formatDuration(hours: number) {
  const total = Math.round(hours * 60);
  const h = Math.floor(total / 60), m = total % 60;
  if (!h && !m) return "0 jam";
  return [h ? `${h} jam` : "", m ? `${m} menit` : ""].filter(Boolean).join(" ");
}

export const round2 = (value: number) => Math.round(value * 100) / 100;

export function buildPayslip({ employee, year, month, planFor, rules, absentFrom, absentBefore, attendanceRows, leaveRows, overtimeRows, components }: CalculationInput): Payslip {
  const { dates } = monthRange(year, month);
  const workingDates = dates.filter((date) => planFor(date, null));
  const leaveByDate = new Map<string, boolean>();
  for (const leave of leaveRows) {
    for (const date of workingDates) if (date >= leave.startDate && date <= leave.endDate) leaveByDate.set(date, leaveByDate.get(date) === true || leave.paid);
  }
  const paidLeaveDates = [...leaveByDate].filter(([, paid]) => paid).map(([date]) => date);
  const unpaidLeaveDays = [...leaveByDate.values()].filter((paid) => !paid).length;

  let daysWorked = 0, lateDays = 0, lateMinutes = 0, lateHours = 0, absentDays = 0, workedMinutes = 0, missingCheckouts = 0;
  const recordedDates = new Set<string>();
  for (const row of attendanceRows) {
    recordedDates.add(row.date);
    if (row.status === "present" || row.status === "late") {
      daysWorked++;
      let span = minutesBetween(row.checkIn, row.checkOut);
      // Forgot to check out on a day that is over (check-out is only possible on the same day):
      // the day counts until the schedule's end time, so the pay is as if they left on time.
      if (row.checkIn && !row.checkOut && row.date < absentBefore) {
        const plan = planFor(row.date, row.scheduleId);
        if (plan) {
          let end = clock(plan.end);
          if (end <= clock(plan.start)) end += 1440;
          span = Math.max(0, end - clock(row.checkIn));
          missingCheckouts++;
        }
      }
      workedMinutes += span - breakMinutesFor(span, minutesBetween(row.breakStart, row.breakEnd), rules);
      if (row.status === "late") {
        lateDays++;
        const plan = planFor(row.date, row.scheduleId);
        const minutes = plan && row.checkIn ? Math.max(0, clock(row.checkIn) - clock(plan.start)) : 0;
        lateMinutes += minutes;
        // "Per jam": every started hour of a late day counts (5 minutes late = 1 hour, 61 minutes = 2 hours).
        lateHours += Math.ceil(minutes / 60);
      }
    } else if (row.status === "absent" && !leaveByDate.has(row.date)) {
      absentDays++;
    }
  }
  // A past working day with no check-in and no approved leave is alpa, just like one marked "Alpa".
  for (const date of workingDates) {
    if (date >= absentFrom && date < absentBefore && !recordedDates.has(date) && !leaveByDate.has(date)) absentDays++;
  }

  // Pay is computed from exact hours; the 2-decimal values are only what the slip stores and shows.
  // (80 minutes x Rp 30.000 must be Rp 40.000, not 1,33 x Rp 30.000 = Rp 39.900.)
  const exactWorkedHours = workedMinutes / 60;
  const exactOvertimeHours = overtimeRows.reduce((total, row) => total + row.minutes, 0) / 60;
  const exactPaidLeaveHours = paidLeaveDates.reduce((total, date) => total + plannedMinutes(planFor(date, null), rules), 0) / 60;
  const workedHours = round2(exactWorkedHours);
  const overtimeHours = round2(exactOvertimeHours);
  const paidLeaveHours = round2(exactPaidLeaveHours);

  const rate = employee.baseSalary;
  const earnings: PayslipLine[] = [];
  const deductions: PayslipLine[] = [];
  if (employee.salaryBasis === "monthly") {
    earnings.push({ name: "Gaji Pokok", quantity: 1, unit: "bulan", rate, amount: rate });
    const dailyRate = workingDates.length ? Math.round(rate / workingDates.length) : 0;
    if (unpaidLeaveDays) deductions.push({ name: "Izin/Cuti Tidak Dibayar", quantity: unpaidLeaveDays, unit: "hari", rate: dailyRate, amount: dailyRate * unpaidLeaveDays });
    if (absentDays && rules.absentDeductionMode === "daily_rate") deductions.push({ name: "Alpa", quantity: absentDays, unit: "hari", rate: dailyRate, amount: dailyRate * absentDays });
  } else if (employee.salaryBasis === "daily") {
    earnings.push({ name: "Upah Harian", quantity: daysWorked, unit: "hari", rate, amount: rate * daysWorked });
    if (paidLeaveDates.length) earnings.push({ name: "Izin/Cuti Dibayar", quantity: paidLeaveDates.length, unit: "hari", rate, amount: rate * paidLeaveDates.length });
  } else {
    earnings.push({ name: "Upah Per Jam", quantity: workedHours, unit: "jam", rate, amount: Math.round(rate * exactWorkedHours) });
    if (paidLeaveHours) earnings.push({ name: "Izin/Cuti Dibayar", quantity: paidLeaveHours, unit: "jam", rate, amount: Math.round(rate * exactPaidLeaveHours) });
  }
  // A fixed alpa penalty applies to every basis (daily/hourly staff are already unpaid for that day).
  if (absentDays && rules.absentDeductionMode === "fixed" && rules.absentDeductionAmount > 0) {
    deductions.push({ name: "Alpa", quantity: absentDays, unit: "hari", rate: rules.absentDeductionAmount, amount: rules.absentDeductionAmount * absentDays });
  }
  if (lateDays && rules.lateDeductionAmount > 0) {
    if (rules.lateDeductionMode === "per_day") deductions.push({ name: "Terlambat", quantity: lateDays, unit: "hari", rate: rules.lateDeductionAmount, amount: rules.lateDeductionAmount * lateDays });
    if (rules.lateDeductionMode === "per_hour" && lateHours) deductions.push({ name: "Terlambat", quantity: lateHours, unit: "jam", rate: rules.lateDeductionAmount, amount: rules.lateDeductionAmount * lateHours });
    if (rules.lateDeductionMode === "per_minute" && lateMinutes) deductions.push({ name: "Terlambat", quantity: lateMinutes, unit: "menit", rate: rules.lateDeductionAmount, amount: rules.lateDeductionAmount * lateMinutes });
  }
  if (overtimeHours) earnings.push({ name: "Lembur", quantity: overtimeHours, unit: "jam", rate: employee.overtimeRate, amount: Math.round(employee.overtimeRate * exactOvertimeHours) });

  for (const component of components) {
    const quantity = component.unit === "month" ? 1 : component.unit === "day" ? daysWorked : workedHours;
    const exactQuantity = component.unit === "hour" ? exactWorkedHours : quantity;
    const unit = component.unit === "month" ? "bulan" : component.unit === "day" ? "hari" : "jam";
    const line = { name: component.name, quantity, unit, rate: component.amount, amount: Math.round(component.amount * exactQuantity) };
    (component.type === "compensation" ? earnings : deductions).push(line);
  }

  const grossPay = earnings.reduce((total, line) => total + line.amount, 0);
  const totalDeductions = deductions.reduce((total, line) => total + line.amount, 0);
  return {
    employee: { id: employee.id, name: employee.name, employeeCode: employee.employeeCode, position: employee.position, department: employee.department },
    year, month, basis: employee.salaryBasis, baseRate: rate,
    summary: { workingDays: workingDates.length, daysWorked, lateDays, lateMinutes, missingCheckouts, absentDays, paidLeaveDays: paidLeaveDates.length, unpaidLeaveDays, workedHours, overtimeHours },
    earnings, deductions, grossPay, totalDeductions, netPay: grossPay - totalDeductions,
    status: "draft", finalizedAt: null,
  };
}
