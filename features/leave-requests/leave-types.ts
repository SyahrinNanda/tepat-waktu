// Leave kinds, labels and small date helpers shared by the forms and the server.
// No zod here: client components import this file, and zod 4 probes eval() when it builds a schema,
// which the Content-Security-Policy forbids. The validation schemas live in server/schemas.ts.

export const LEAVE_TYPES = ["annual", "sick", "permission", "special"] as const;
export type LeaveType = (typeof LEAVE_TYPES)[number];

export const leaveTypeLabels: Record<LeaveType, string> = { annual: "Cuti Tahunan", sick: "Sakit", permission: "Izin", special: "Cuti Khusus" };

/** "Cuti Khusus · Menikah" for special leave, otherwise the category label. */
export function leaveLabel(type: string, specialName?: string | null) {
  const base = leaveTypeLabels[type as LeaveType] ?? type;
  return type === "special" && specialName ? `${base} · ${specialName}` : base;
}

export function leaveDays(start: string, end: string) {
  return Math.floor((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000) + 1;
}

/**
 * Common kinds under Indonesian labor law (UU 13/2003 ps. 82 & 93), offered as one-click suggestions.
 * Durations are working days; Melahirkan (3 bulan) and Keguguran (1,5 bulan) assume a 5-day week, so a
 * company working 6 days a week should raise them.
 */
export const SPECIAL_LEAVE_SUGGESTIONS: { name: string; durationDays: number }[] = [
  { name: "Menikah", durationDays: 3 },
  { name: "Menikahkan Anak", durationDays: 2 },
  { name: "Khitanan / Baptis Anak", durationDays: 2 },
  { name: "Istri Melahirkan / Keguguran", durationDays: 2 },
  { name: "Melahirkan", durationDays: 65 },
  { name: "Keguguran", durationDays: 33 },
  { name: "Berduka (Keluarga Inti)", durationDays: 2 },
  { name: "Berduka (Anggota Keluarga Serumah)", durationDays: 1 },
];
