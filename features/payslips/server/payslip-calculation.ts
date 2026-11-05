// Pure payslip arithmetic (no database access) so the rules can be reasoned about and tested.

export type SalaryBasis = "hourly" | "daily" | "monthly";
export type PayslipLine = { name: string; quantity: number; unit: string; rate: number; amount: number };
export type PayslipSummary = {
  workingDays: number;
  daysWorked: number;
  lateDays: number;
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

export type CalculationEmployee = Payslip["employee"] & { baseSalary: number; overtimeRate: number; salaryBasis: SalaryBasis };
export type CalculationInput = {
  employee: CalculationEmployee;
  year: number;
  month: number;
  workWeek: Map<number, number>;
  attendanceRows: { date: string; status: "present" | "late" | "absent" | "leave"; checkIn: string | null; checkOut: string | null; breakStart: string | null; breakEnd: string | null }[];
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

export function hoursBetween(start: string | null, end: string | null) {
  if (!start || !end) return 0;
  const toMinutes = (value: string) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5));
  const minutes = toMinutes(end) - toMinutes(start);
  return minutes > 0 ? minutes / 60 : 0;
}

export const round2 = (value: number) => Math.round(value * 100) / 100;

export function buildPayslip({ employee, year, month, workWeek, attendanceRows, leaveRows, overtimeRows, components }: CalculationInput): Payslip {
  const { dates } = monthRange(year, month);
  const workingDates = dates.filter((date) => workWeek.has(weekday(date)));
  const leaveByDate = new Map<string, boolean>();
  for (const leave of leaveRows) {
    for (const date of workingDates) if (date >= leave.startDate && date <= leave.endDate) leaveByDate.set(date, leaveByDate.get(date) === true || leave.paid);
  }
  const paidLeaveDates = [...leaveByDate].filter(([, paid]) => paid).map(([date]) => date);
  const unpaidLeaveDays = [...leaveByDate.values()].filter((paid) => !paid).length;

  let daysWorked = 0, lateDays = 0, absentDays = 0, workedHours = 0;
  for (const row of attendanceRows) {
    if (row.status === "present" || row.status === "late") {
      daysWorked++;
      if (row.status === "late") lateDays++;
      workedHours += Math.max(0, hoursBetween(row.checkIn, row.checkOut) - hoursBetween(row.breakStart, row.breakEnd));
    } else if (row.status === "absent" && !leaveByDate.has(row.date)) {
      absentDays++;
    }
  }
  workedHours = round2(workedHours);
  const overtimeHours = round2(overtimeRows.reduce((total, row) => total + row.minutes, 0) / 60);
  const paidLeaveHours = round2(paidLeaveDates.reduce((total, date) => total + (workWeek.get(weekday(date)) ?? 8), 0));

  const rate = employee.baseSalary;
  const earnings: PayslipLine[] = [];
  const deductions: PayslipLine[] = [];
  if (employee.salaryBasis === "monthly") {
    earnings.push({ name: "Gaji Pokok", quantity: 1, unit: "bulan", rate, amount: rate });
    const dailyRate = workingDates.length ? Math.round(rate / workingDates.length) : 0;
    if (unpaidLeaveDays) deductions.push({ name: "Izin/Cuti Tidak Dibayar", quantity: unpaidLeaveDays, unit: "hari", rate: dailyRate, amount: dailyRate * unpaidLeaveDays });
    if (absentDays) deductions.push({ name: "Alpa", quantity: absentDays, unit: "hari", rate: dailyRate, amount: dailyRate * absentDays });
  } else if (employee.salaryBasis === "daily") {
    earnings.push({ name: "Upah Harian", quantity: daysWorked, unit: "hari", rate, amount: rate * daysWorked });
    if (paidLeaveDates.length) earnings.push({ name: "Izin/Cuti Dibayar", quantity: paidLeaveDates.length, unit: "hari", rate, amount: rate * paidLeaveDates.length });
  } else {
    earnings.push({ name: "Upah Per Jam", quantity: workedHours, unit: "jam", rate, amount: Math.round(rate * workedHours) });
    if (paidLeaveHours) earnings.push({ name: "Izin/Cuti Dibayar", quantity: paidLeaveHours, unit: "jam", rate, amount: Math.round(rate * paidLeaveHours) });
  }
  if (overtimeHours) earnings.push({ name: "Lembur", quantity: overtimeHours, unit: "jam", rate: employee.overtimeRate, amount: Math.round(employee.overtimeRate * overtimeHours) });

  for (const component of components) {
    const quantity = component.unit === "month" ? 1 : component.unit === "day" ? daysWorked : workedHours;
    const unit = component.unit === "month" ? "bulan" : component.unit === "day" ? "hari" : "jam";
    const line = { name: component.name, quantity, unit, rate: component.amount, amount: Math.round(component.amount * quantity) };
    (component.type === "compensation" ? earnings : deductions).push(line);
  }

  const grossPay = earnings.reduce((total, line) => total + line.amount, 0);
  const totalDeductions = deductions.reduce((total, line) => total + line.amount, 0);
  return {
    employee: { id: employee.id, name: employee.name, employeeCode: employee.employeeCode, position: employee.position, department: employee.department },
    year, month, basis: employee.salaryBasis, baseRate: rate,
    summary: { workingDays: workingDates.length, daysWorked, lateDays, absentDays, paidLeaveDays: paidLeaveDates.length, unpaidLeaveDays, workedHours, overtimeHours },
    earnings, deductions, grossPay, totalDeductions, netPay: grossPay - totalDeductions,
    status: "draft", finalizedAt: null,
  };
}
