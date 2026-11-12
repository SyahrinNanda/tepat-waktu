/** Contract types, the same list as the employee form's "Tipe Kontrak". */
export const CONTRACT_TYPES = ["Tetap", "Kontrak", "Magang", "Harian Lepas"] as const;

/** Last day of a contract (start + N months - 1 day), or null when it has no end date. */
export function contractEndDate(startDate: string, durationMonths: number | null) {
  if (!durationMonths) return null;
  const [year, month, day] = startDate.split("-").map(Number);
  const target = new Date(Date.UTC(year, month - 1 + durationMonths, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  target.setUTCDate(target.getUTCDate() - 1);
  return target.toISOString().slice(0, 10);
}
