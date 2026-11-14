// Period + search of the payslip list, shared by the list, the Excel export and the combined print (no server imports).
import type { Payslip } from "@/features/payslips/server/payslip-calculation";
import { periodContaining } from "@/features/payslips/payroll-period";

/** The list search (name, NIK, division); the exports use the same match so they hold what the admin sees. */
export function matchesPayslipQuery(slip: Payslip, query: string) {
  return `${slip.employee.name} ${slip.employee.employeeCode} ${slip.employee.department}`.toLowerCase().includes(query.trim().toLowerCase());
}

/**
 * Year/month from the query string, defaulting to the payroll period running today. With a period
 * start day of 26, on 14 Nov that is "Oktober" (26 Okt – 25 Nov), not the calendar month.
 */
export function payslipPeriod(params: { year?: string | null; month?: string | null }, timeZone: string, periodStartDay = 1) {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const current = periodContaining(today, periodStartDay);
  const validYear = /^20\d{2}$/.test(params.year ?? ""), validMonth = /^(0?[1-9]|1[0-2])$/.test(params.month ?? "");
  if (!validYear && !validMonth) return current;
  return { year: validYear ? Number(params.year) : current.year, month: validMonth ? Number(params.month) : current.month };
}
