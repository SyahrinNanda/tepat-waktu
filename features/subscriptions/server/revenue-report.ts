import { and, desc, eq, gt, gte, isNotNull, ne } from "drizzle-orm";
import { db } from "@/db";
import { companies, subscriptionOrders, subscriptionPlans } from "@/db/schema";
import { PAYMENT_LABELS } from "../plan-rules";

const TIME_ZONE = "Asia/Makassar";
const monthKey = (value: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit" }).format(value).slice(0, 7);
const monthLabel = (key: string) => new Intl.DateTimeFormat("id-ID", { month: "short", year: "2-digit", timeZone: "UTC" }).format(new Date(`${key}-15T00:00:00Z`));

export type RevenueTransaction = {
  invoiceNumber: string; company: string; plan: string; type: string; durationMonths: number; durationDays: number;
  revenue: number; adminFee: number; amount: number; method: string; status: "verified" | "awaiting_payment" | "awaiting_verification";
  createdAt: Date; verifiedAt: Date | null;
};

export type RevenueReport = {
  months: { key: string; label: string; revenue: number; count: number }[];
  total: number; count: number; average: number;
  thisMonth: number; lastMonth: number;
  pending: { awaitingPayment: { count: number; amount: number }; awaitingVerification: { count: number; amount: number } };
  byPlan: { label: string; revenue: number; count: number }[];
  byMethod: { label: string; revenue: number; count: number }[];
  transactions: RevenueTransaction[];
};

/** Last 12 calendar months (Asia/Makassar), oldest first, ending with the current month. */
export function lastTwelveMonths(now = new Date()) {
  const [year, month] = monthKey(now).split("-").map(Number);
  return Array.from({ length: 12 }, (_, index) => {
    const date = new Date(Date.UTC(year, month - 1 - (11 - index), 15));
    return date.toISOString().slice(0, 7);
  });
}

/**
 * Revenue = package value (subtotal − discount) of verified, non-rejected paid orders, counted in
 * the month it was verified. Payment-gateway admin fees are reported separately.
 */
export async function getRevenueReport(now = new Date()): Promise<RevenueReport> {
  const keys = lastTwelveMonths(now);
  const since = new Date(`${keys[0]}-01T00:00:00+08:00`);
  const select = {
    invoiceNumber: subscriptionOrders.invoiceNumber, company: companies.name, plan: subscriptionPlans.name, type: subscriptionOrders.transactionType,
    durationMonths: subscriptionOrders.durationMonths, durationDays: subscriptionOrders.durationDays, subtotal: subscriptionOrders.subtotal,
    discount: subscriptionOrders.discountAmount, adminFee: subscriptionOrders.adminFee, amount: subscriptionOrders.amount, method: subscriptionOrders.paymentMethod,
    paymentRequestedAt: subscriptionOrders.paymentRequestedAt, createdAt: subscriptionOrders.createdAt, verifiedAt: subscriptionOrders.verifiedAt,
  };
  const base = () => db.select(select).from(subscriptionOrders)
    .innerJoin(companies, eq(subscriptionOrders.companyId, companies.id))
    .innerJoin(subscriptionPlans, eq(subscriptionOrders.planId, subscriptionPlans.id));
  const [verified, pending] = await Promise.all([
    base().where(and(isNotNull(subscriptionOrders.verifiedAt), gte(subscriptionOrders.verifiedAt, since), ne(subscriptionOrders.status, "rejected"), ne(subscriptionOrders.status, "pending"), gt(subscriptionOrders.amount, 0))).orderBy(desc(subscriptionOrders.verifiedAt)),
    base().where(and(eq(subscriptionOrders.status, "pending"), gt(subscriptionOrders.amount, 0))).orderBy(desc(subscriptionOrders.createdAt)),
  ]);

  const months = new Map(keys.map((key) => [key, { key, label: monthLabel(key), revenue: 0, count: 0 }]));
  const byPlan = new Map<string, { label: string; revenue: number; count: number }>();
  const byMethod = new Map<string, { label: string; revenue: number; count: number }>();
  const transactions: RevenueTransaction[] = [];
  let total = 0;
  for (const row of verified) {
    const revenue = Math.max(0, row.subtotal - row.discount);
    const bucket = months.get(monthKey(row.verifiedAt!));
    if (!bucket) continue;
    bucket.revenue += revenue; bucket.count += 1; total += revenue;
    const plan = byPlan.get(row.plan) ?? byPlan.set(row.plan, { label: row.plan, revenue: 0, count: 0 }).get(row.plan)!;
    plan.revenue += revenue; plan.count += 1;
    const methodLabel = row.method ? PAYMENT_LABELS[row.method] ?? row.method : "Tanpa metode";
    const method = byMethod.get(methodLabel) ?? byMethod.set(methodLabel, { label: methodLabel, revenue: 0, count: 0 }).get(methodLabel)!;
    method.revenue += revenue; method.count += 1;
    transactions.push({ ...row, revenue, method: methodLabel, status: "verified" });
  }
  const awaitingPayment = { count: 0, amount: 0 };
  const awaitingVerification = { count: 0, amount: 0 };
  for (const row of pending) {
    const verifying = Boolean(row.paymentRequestedAt);
    const target = verifying ? awaitingVerification : awaitingPayment;
    target.count += 1; target.amount += row.amount;
    transactions.push({ ...row, revenue: Math.max(0, row.subtotal - row.discount), method: row.method ? PAYMENT_LABELS[row.method] ?? row.method : "Belum dipilih", status: verifying ? "awaiting_verification" : "awaiting_payment" });
  }
  const monthList = [...months.values()];
  const sortDesc = (a: { revenue: number }, b: { revenue: number }) => b.revenue - a.revenue;
  return {
    months: monthList, total, count: verified.length, average: Math.round(total / 12),
    thisMonth: monthList[11].revenue, lastMonth: monthList[10].revenue,
    pending: { awaitingPayment, awaitingVerification },
    byPlan: [...byPlan.values()].sort(sortDesc),
    byMethod: [...byMethod.values()].sort(sortDesc),
    transactions,
  };
}
