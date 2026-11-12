/**
 * Cuti Tahunan per employee period: a period runs from the employee's work anniversary (tanggal bergabung)
 * to the day before the next one, and the quota resets automatically when a new period starts. The
 * company decides how many days a period gives, whether the first year already earns leave, and whether
 * an unused balance carries over. Pure functions: usable on the server and in the browser.
 */

export const LEAVE_ELIGIBILITY = ["immediate", "after_one_year"] as const;
export type LeaveEligibility = (typeof LEAVE_ELIGIBILITY)[number];

export type AnnualLeaveRules = {
  /** Days a period gives (default 12). */
  days: number;
  /** "immediate": from the join date; "after_one_year": the first period gives nothing (UU 13/2003 ps. 79). */
  eligibility: LeaveEligibility;
  /** Unused days move to the next period instead of expiring. */
  carryOver: boolean;
  /** Most days that may move to the next period; null = no limit. */
  carryOverMax: number | null;
};

export const DEFAULT_LEAVE_RULES: AnnualLeaveRules = { days: 12, eligibility: "immediate", carryOver: false, carryOverMax: null };

export type LeavePeriod = { index: number; start: string; end: string; nextReset: string };

export type AnnualLeaveBalance = LeavePeriod & {
  /** Days of this period (company rule, or the per-employee override for the period). */
  base: number;
  /** Days carried over from the previous period. */
  carried: number;
  entitled: number;
  used: number;
  pending: number;
  /** entitled - used (may be negative after an approval beyond the quota). */
  remaining: number;
  /** remaining - pending: what a new request may still take. */
  available: number;
  /** False in the first period when leave only starts after 12 months of work. */
  eligible: boolean;
  /** Join anniversary from which leave is earned (for "after_one_year"). */
  eligibleFrom: string;
};

export type AnnualLeaveRequest = { startDate: string; workDays: number; status: "pending" | "approved" | "rejected" };

const pad = (value: number) => String(value).padStart(2, "0");

/** The join date moved by whole years; 29 Feb becomes 28 Feb in a non-leap year. */
export function anniversary(joinedAt: string, years: number) {
  const [year, month, day] = joinedAt.split("-").map(Number);
  const targetYear = year + years;
  const lastDay = new Date(Date.UTC(targetYear, month, 0)).getUTCDate();
  return `${targetYear}-${pad(month)}-${pad(Math.min(day, lastDay))}`;
}

export function shiftDate(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

/** The leave period containing `date` (dates before the join date belong to the first period). */
export function leavePeriodFor(joinedAt: string, date: string): LeavePeriod {
  let index = Math.max(0, Number(date.slice(0, 4)) - Number(joinedAt.slice(0, 4)));
  while (index > 0 && anniversary(joinedAt, index) > date) index--;
  while (anniversary(joinedAt, index + 1) <= date) index++;
  const nextReset = anniversary(joinedAt, index + 1);
  return { index, start: anniversary(joinedAt, index), end: shiftDate(nextReset, -1), nextReset };
}

/**
 * Balance of the period containing `asOf`. Requests count in the period of their start date (a request
 * may not cross a reset date). `overrides` maps the start year of a period to a custom number of days.
 */
export function annualLeaveBalance(input: { rules: AnnualLeaveRules; joinedAt: string; asOf: string; requests: AnnualLeaveRequest[]; overrides?: Map<number, number> }): AnnualLeaveBalance {
  const { rules, joinedAt } = input;
  const target = leavePeriodFor(joinedAt, input.asOf);
  const totals = new Map<number, { used: number; pending: number }>();
  for (const request of input.requests) {
    if (request.status === "rejected") continue;
    const { index } = leavePeriodFor(joinedAt, request.startDate);
    const entry = totals.get(index) ?? { used: 0, pending: 0 };
    if (request.status === "approved") entry.used += request.workDays; else entry.pending += request.workDays;
    totals.set(index, entry);
  }
  let previousRemaining = 0;
  let balance: AnnualLeaveBalance | null = null;
  for (let index = 0; index <= target.index; index++) {
    const start = anniversary(joinedAt, index), nextReset = anniversary(joinedAt, index + 1);
    // A per-employee override (set by HR) applies even in a first year without leave rights.
    const override = input.overrides?.get(Number(start.slice(0, 4)));
    const eligible = override !== undefined || !(rules.eligibility === "after_one_year" && index === 0);
    const base = override ?? (eligible ? rules.days : 0);
    const carried = index > 0 && rules.carryOver ? Math.min(Math.max(previousRemaining, 0), rules.carryOverMax ?? Number.POSITIVE_INFINITY) : 0;
    const { used, pending } = totals.get(index) ?? { used: 0, pending: 0 };
    const entitled = base + carried, remaining = entitled - used;
    balance = { index, start, end: shiftDate(nextReset, -1), nextReset, base, carried, entitled, used, pending, remaining, available: remaining - pending, eligible, eligibleFrom: rules.eligibility === "after_one_year" ? anniversary(joinedAt, 1) : joinedAt };
    previousRemaining = remaining;
  }
  return balance!;
}

export function describeLeaveRules(rules: AnnualLeaveRules) {
  return [
    `${rules.days} hari kerja per periode`,
    rules.eligibility === "after_one_year" ? "mulai setelah 12 bulan kerja" : "langsung sejak bergabung",
    rules.carryOver ? `sisa dibawa ke periode berikutnya${rules.carryOverMax != null ? ` (maks. ${rules.carryOverMax} hari)` : ""}` : "sisa hangus saat reset",
  ].join(" · ");
}
