/**
 * Pure tests for payslip alpa/late rules per employee (no database).
 * Run: npx tsx scripts/test-payslip-rules.ts
 */
import { buildPayslip, DEFAULT_PAYROLL_RULES, type CalculationInput, type EmployeeAttendanceRule, type PayrollRules } from "@/features/payslips/server/payslip-calculation";

let passed = 0, failed = 0;
function check(ok: boolean, name: string, detail = "") {
  if (ok) passed++; else failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  -- ${detail}` : ""}`);
}

// November 2026: 1 Nov is a Sunday. Mon-Fri 08:00-17:00 position schedule.
const planFor: CalculationInput["planFor"] = (date) => {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return day >= 1 && day <= 5 ? { start: "08:00:00", end: "17:00:00" } : null;
};
const worked = (date: string, status: "present" | "late" = "present", checkIn = "08:00:00") => ({ date, scheduleId: null, status, checkIn, checkOut: "17:00:00", breakStart: null, breakEnd: null });
const alpa = (date: string) => ({ date, scheduleId: null, status: "absent" as const, checkIn: null, checkOut: null, breakStart: null, breakEnd: null });

function slip(opts: { basis?: "monthly" | "daily" | "hourly"; rule?: EmployeeAttendanceRule; rules?: Partial<PayrollRules>; rows?: CalculationInput["attendanceRows"]; leaves?: CalculationInput["leaveRows"] }) {
  return buildPayslip({
    employee: { id: "e1", name: "Uji", employeeCode: "E1", department: "Staf", position: "Umum", baseSalary: opts.basis === "daily" ? 100_000 : 2_100_000, overtimeRate: 0, salaryBasis: opts.basis ?? "monthly", attendanceRule: opts.rule },
    year: 2026, month: 11, planFor, rules: { ...DEFAULT_PAYROLL_RULES, ...opts.rules },
    // Days up to (not including) 6 Nov are over: Mon 2 - Thu 5 are past working days.
    absentFrom: "2026-11-01", absentBefore: "2026-11-06",
    attendanceRows: opts.rows ?? [], leaveRows: opts.leaves ?? [], overtimeRows: [], components: [],
  });
}
const line = (s: ReturnType<typeof slip>, name: string) => s.deductions.find((item) => item.name === name);
const manual = (amount: number): EmployeeAttendanceRule => ({ absentRule: "manual_only", absentManualAmount: amount, lateRule: "company", lateMode: "per_day", lateAmount: 0 });

// (a) No employee rule: unchanged behaviour (2 past working days empty = 2 alpa at the daily rate).
{
  const s = slip({ rows: [worked("2026-11-02"), worked("2026-11-03")] });
  check(s.summary.absentDays === 2 && line(s, "Alpa")?.quantity === 2, "Tanpa aturan karyawan: hari kosong = alpa (perilaku lama)", JSON.stringify(s.summary));
}
// (b) manual_only, monthly: empty days are days off; only the manual alpa is deducted, at the employee amount.
{
  const s = slip({ rule: manual(50_000), rows: [worked("2026-11-02"), alpa("2026-11-03")] });
  const a = line(s, "Alpa");
  check(s.summary.absentDays === 1 && a?.amount === 50_000 && a.rate === 50_000 && s.deductions.length === 1, "Hanya alpa manual (bulanan): 1 alpa manual x Rp 50.000, hari kosong tidak dipotong", JSON.stringify({ summary: s.summary, deductions: s.deductions }));
}
// (b2) manual_only with amount 0: alpa is recorded but not deducted.
{
  const s = slip({ rule: manual(0), rows: [alpa("2026-11-03")] });
  check(s.summary.absentDays === 1 && !line(s, "Alpa"), "Hanya alpa manual, nominal 0: tercatat tanpa potongan", JSON.stringify(s.deductions));
}
// (b3) manual_only ignores the company "fixed" alpa penalty.
{
  const s = slip({ rule: manual(0), rules: { absentDeductionMode: "fixed", absentDeductionAmount: 99_000 }, rows: [alpa("2026-11-03")] });
  check(!line(s, "Alpa"), "Hanya alpa manual: aturan potongan alpa perusahaan tidak dipakai", JSON.stringify(s.deductions));
}
// (c) manual_only, daily: paid leave on a Sunday (not a position working day) is still paid.
{
  const s = slip({ basis: "daily", rule: manual(0), rows: [worked("2026-11-01")], leaves: [{ startDate: "2026-11-08", endDate: "2026-11-08", paid: true }] });
  const paid = s.earnings.find((item) => item.name === "Izin/Cuti Dibayar");
  check(s.summary.daysWorked === 1 && paid?.quantity === 1 && paid.amount === 100_000 && s.summary.absentDays === 0, "Hanya alpa manual (harian): kerja & cuti dibayar di hari Minggu dihitung, tanpa alpa otomatis", JSON.stringify({ earnings: s.earnings, summary: s.summary }));
}
// (d) late none: no late line even when the company deducts per day.
{
  const s = slip({ rule: { ...manual(0), absentRule: "company", lateRule: "none" }, rules: { lateDeductionMode: "per_day", lateDeductionAmount: 25_000 }, rows: [worked("2026-11-02", "late", "08:30:00"), worked("2026-11-03"), worked("2026-11-04"), worked("2026-11-05")] });
  check(s.summary.lateDays === 1 && !line(s, "Terlambat"), "Terlambat tidak dihitung: tidak ada potongan walau perusahaan memotong", JSON.stringify(s.deductions));
}
// (e) late custom per hour Rp 10.000: 61 minutes late = 2 started hours = Rp 20.000 (company rule ignored).
{
  const s = slip({ rule: { ...manual(0), absentRule: "company", lateRule: "custom", lateMode: "per_hour", lateAmount: 10_000 }, rules: { lateDeductionMode: "per_day", lateDeductionAmount: 25_000 }, rows: [worked("2026-11-02", "late", "09:01:00"), worked("2026-11-03"), worked("2026-11-04"), worked("2026-11-05")] });
  const t = line(s, "Terlambat");
  check(t?.quantity === 2 && t.amount === 20_000 && t.unit === "jam", "Terlambat khusus per jam: 61 menit = 2 jam x Rp 10.000", JSON.stringify(t));
}
// (e2) late custom per minute.
{
  const s = slip({ rule: { ...manual(0), absentRule: "company", lateRule: "custom", lateMode: "per_minute", lateAmount: 1_000 }, rows: [worked("2026-11-02", "late", "08:15:00"), worked("2026-11-03"), worked("2026-11-04"), worked("2026-11-05")] });
  check(line(s, "Terlambat")?.amount === 15_000, "Terlambat khusus per menit: 15 menit x Rp 1.000", JSON.stringify(line(s, "Terlambat")));
}
// (f) "company" late rule follows the company setting.
{
  const s = slip({ rule: { ...manual(0), absentRule: "company" }, rules: { lateDeductionMode: "per_day", lateDeductionAmount: 25_000 }, rows: [worked("2026-11-02", "late", "08:30:00"), worked("2026-11-03"), worked("2026-11-04"), worked("2026-11-05")] });
  check(line(s, "Terlambat")?.amount === 25_000, "Terlambat ikuti perusahaan: Rp 25.000 per hari", JSON.stringify(line(s, "Terlambat")));
}

console.log(`\nSummary: ${passed} passed, ${failed} failed, ${passed + failed} total`);
if (failed) process.exitCode = 1;
