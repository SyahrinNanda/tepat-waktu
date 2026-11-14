// Payroll periods (no server imports: used by the calculation, the pages and the settings form).
//
// A company's period starts on `startDay` (1–28) of a month. Day 1 is the default calendar month.
// A period is named after the month it STARTS in: with startDay 26, "Oktober 2026" = 26 Okt – 25 Nov 2026.

export const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const shortMonths = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

export const MIN_PERIOD_START_DAY = 1;
export const MAX_PERIOD_START_DAY = 28;

const pad = (value: number) => String(value).padStart(2, "0");
const iso = (date: Date) => `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
const utc = (value: string) => new Date(`${value}T00:00:00Z`);
export const addDays = (value: string, days: number) => { const date = utc(value); date.setUTCDate(date.getUTCDate() + days); return iso(date); };

export function normalizeStartDay(value: number | null | undefined) {
  const day = Math.floor(Number(value) || 1);
  return Math.min(MAX_PERIOD_START_DAY, Math.max(MIN_PERIOD_START_DAY, day));
}

/** The period named year/month: [start, end] inclusive and every date in it. */
export function payrollPeriod(year: number, month: number, startDay = 1) {
  const day = normalizeStartDay(startDay);
  const start = `${year}-${pad(month)}-${pad(day)}`;
  // Next month's (startDay - 1); Date.UTC rolls day 0 back to the last day of this month.
  const end = iso(new Date(Date.UTC(year, month, day - 1)));
  const dates: string[] = [];
  for (let date = start; date <= end; date = addDays(date, 1)) dates.push(date);
  return { start, end, dates };
}

/** The period (by name) that contains a date, e.g. 2026-11-14 with startDay 26 → Oktober 2026. */
export function periodContaining(date: string, startDay = 1) {
  const day = normalizeStartDay(startDay);
  let year = Number(date.slice(0, 4)), month = Number(date.slice(5, 7));
  if (Number(date.slice(8, 10)) < day) { month -= 1; if (month === 0) { month = 12; year -= 1; } }
  return { year, month };
}

export function nextPeriodName(year: number, month: number) {
  return month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
}

/** "26 Okt – 25 Nov 2026", "1 – 30 Nov 2026", "26 Des 2026 – 25 Jan 2027". */
export function formatPeriodRange(start: string, end: string) {
  const [sy, sm, sd] = [Number(start.slice(0, 4)), Number(start.slice(5, 7)), Number(start.slice(8, 10))];
  const [ey, em, ed] = [Number(end.slice(0, 4)), Number(end.slice(5, 7)), Number(end.slice(8, 10))];
  if (sy === ey && sm === em) return `${sd} – ${ed} ${shortMonths[em - 1]} ${ey}`;
  if (sy === ey) return `${sd} ${shortMonths[sm - 1]} – ${ed} ${shortMonths[em - 1]} ${ey}`;
  return `${sd} ${shortMonths[sm - 1]} ${sy} – ${ed} ${shortMonths[em - 1]} ${ey}`;
}

export function periodLabel(year: number, month: number) {
  return `${monthNames[month - 1]} ${year}`;
}

/**
 * What changing the start day does next to the newest locked slip: the next period should start the
 * day after that slip ended. Otherwise some dates are counted twice (overlap) or in no slip (gap).
 */
export function periodTransition(latestFinal: { year: number; month: number; end: string } | null, startDay: number) {
  if (!latestFinal) return null;
  const next = nextPeriodName(latestFinal.year, latestFinal.month);
  const period = payrollPeriod(next.year, next.month, startDay);
  const expected = addDays(latestFinal.end, 1);
  if (period.start === expected) return null;
  const base = { finalLabel: periodLabel(latestFinal.year, latestFinal.month), nextLabel: periodLabel(next.year, next.month), nextRange: formatPeriodRange(period.start, period.end) };
  return period.start > expected
    ? { kind: "gap" as const, ...base, from: expected, to: addDays(period.start, -1) }
    : { kind: "overlap" as const, ...base, from: period.start, to: latestFinal.end };
}
