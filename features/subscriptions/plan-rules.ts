/** Pricing rules shared by registration, tenant subscription pages and the superadmin panel. */

/** Above the largest public tier (Enterprise, 1.000 karyawan) a company negotiates a custom plan. */
export const CUSTOM_MIN_EMPLOYEES = 1001;
/** Negotiable, but never below this monthly price per employee. */
export const CUSTOM_PRICE_FLOOR = 6500;
export const DURATION_OPTIONS = [1, 3, 6, 8, 12] as const;

type PricedPlan = { monthlyPrice: number; maxEmployees: number };
type TrialPlan = { trialDays: number; trialMonths: number };

export function pricePerEmployee(plan: PricedPlan) {
  return plan.maxEmployees > 0 ? Math.round(plan.monthlyPrice / plan.maxEmployees) : 0;
}

/** "14 hari" / "2 bulan", or null when the plan has no free period. */
export function trialLabel(plan: TrialPlan) {
  if (plan.trialDays > 0) return `${plan.trialDays} hari`;
  if (plan.trialMonths > 0) return `${plan.trialMonths} bulan`;
  return null;
}

/** Length of a free plan's period. A day-based trial wins over the legacy month field. */
export function trialPeriod(plan: TrialPlan) {
  if (plan.trialDays > 0) return { durationMonths: 0, durationDays: plan.trialDays };
  return { durationMonths: Math.max(plan.trialMonths, 1), durationDays: 0 };
}

export function periodEnd(start: Date, period: { durationMonths: number; durationDays: number }) {
  const end = new Date(start);
  if (period.durationDays > 0) end.setDate(end.getDate() + period.durationDays);
  else end.setMonth(end.getMonth() + period.durationMonths);
  return end;
}

export function durationLabel(order: { durationMonths: number; durationDays?: number | null }) {
  return order.durationDays ? `${order.durationDays} Hari` : `${order.durationMonths} Bulan`;
}

export const formatRupiah = (value: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value);

export const PAYMENT_LABELS: Record<string, string> = {
  credit_card: "Kartu Kredit",
  bank_transfer: "Bank Transfer",
  shopeepay: "ShopeePay",
  indomaret: "Indomaret",
  alfamart: "Alfamart",
  akulaku: "Akulaku Paylater",
  qris: "QRIS",
  manual: "Manual (superadmin)",
};
