/**
 * Time zones a company (or user profile) can pick. Pure module: safe in client components.
 * Company data (attendance days, reports, subscription dates shown to the company) uses the
 * company's own zone (companies.timezone); superadmin/platform pages use WITA on purpose.
 */
export const TIMEZONE_OPTIONS = [
  { value: "Asia/Jakarta", label: "WIB (Asia/Jakarta)", short: "WIB" },
  { value: "Asia/Makassar", label: "WITA (Asia/Makassar)", short: "WITA" },
  { value: "Asia/Jayapura", label: "WIT (Asia/Jayapura)", short: "WIT" },
] as const;

export type SupportedTimeZone = (typeof TIMEZONE_OPTIONS)[number]["value"];
export const TIMEZONE_VALUES = TIMEZONE_OPTIONS.map((zone) => zone.value) as [SupportedTimeZone, ...SupportedTimeZone[]];

/** Same as the companies.timezone column default. */
export const DEFAULT_COMPANY_TIMEZONE: SupportedTimeZone = "Asia/Makassar";

/** A usable IANA zone: the given one when valid, otherwise the company default. */
export function resolveTimeZone(value?: string | null): string {
  if (!value) return DEFAULT_COMPANY_TIMEZONE;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return value;
  } catch {
    return DEFAULT_COMPANY_TIMEZONE;
  }
}

/** WIB / WITA / WIT, or the raw zone name for anything else. */
export function timeZoneShortLabel(value: string) {
  return TIMEZONE_OPTIONS.find((zone) => zone.value === value)?.short ?? value;
}
