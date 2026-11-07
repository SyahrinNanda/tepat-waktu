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
  bank_transfer: "Virtual Account (BCA, BNI, BRI, Mandiri, Permata, CIMB)",
  qris: "QRIS",
  gopay: "GoPay",
  shopeepay: "ShopeePay",
  credit_card: "Kartu Kredit/Debit",
  indomaret: "Indomaret",
  alfamart: "Alfamart",
  akulaku: "Akulaku Paylater",
  manual: "Manual (superadmin)",
};

/** Methods the company admin can pay with through Midtrans, in display order. */
export const ONLINE_PAYMENT_METHODS = ["bank_transfer", "qris", "gopay", "shopeepay", "credit_card", "indomaret", "alfamart", "akulaku"] as const;
export type OnlinePaymentMethod = typeof ONLINE_PAYMENT_METHODS[number];

/** Admin fee charged to the customer per method (follows Midtrans' fee per channel). */
export function paymentAdminFee(method: string, packagePrice: number) {
  switch (method) {
    case "credit_card": return Math.round(packagePrice * 0.029) + 2_000;
    case "bank_transfer": return 4_000;
    case "qris": return Math.round(packagePrice * 0.007);
    case "gopay": return Math.round(packagePrice * 0.02);
    case "shopeepay": return Math.round(packagePrice * 0.02);
    case "indomaret": case "alfamart": return 5_000;
    case "akulaku": return Math.round(packagePrice * 0.017);
    default: return 0;
  }
}
