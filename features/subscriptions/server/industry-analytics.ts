import { and, count, eq } from "drizzle-orm";
import { db } from "@/db";
import { companies, employees, subscriptionOrders, subscriptionPlans } from "@/db/schema";
import { describeSubscription } from "./subscription-status";

/** Industry options offered at registration; legacy values found in the data are kept as-is. */
export const INDUSTRIES = ["Teknologi", "Pemerintahan", "F&B", "Jasa", "Media", "Lainnya"] as const;

export type IndustryRow = {
  industry: string;
  companies: number;
  /** Active subscription on a paid plan. */
  paid: number;
  /** Active subscription on a free plan (Free Trial). */
  trial: number;
  expired: number;
  /** Legacy companies without any subscription record. */
  untracked: number;
  activeEmployees: number;
  /** Monthly recurring revenue from paid companies, in rupiah. */
  mrr: number;
};

export type IndustryAnalytics = {
  rows: IndustryRow[];
  totals: Omit<IndustryRow, "industry">;
};

export async function getIndustryAnalytics(now = new Date()): Promise<IndustryAnalytics> {
  const [companyRows, activeOrders, orderedCompanies, employeeCounts] = await Promise.all([
    db.select({ id: companies.id, industry: companies.industry }).from(companies),
    db.select({ id: subscriptionOrders.id, companyId: subscriptionOrders.companyId, endsAt: subscriptionOrders.endsAt, createdAt: subscriptionOrders.createdAt, planName: subscriptionPlans.name, monthlyPrice: subscriptionPlans.monthlyPrice })
      .from(subscriptionOrders).innerJoin(subscriptionPlans, eq(subscriptionOrders.planId, subscriptionPlans.id))
      .where(eq(subscriptionOrders.status, "active")),
    db.selectDistinct({ companyId: subscriptionOrders.companyId }).from(subscriptionOrders),
    db.select({ companyId: employees.companyId, value: count() }).from(employees).where(and(eq(employees.status, "active"))).groupBy(employees.companyId),
  ]);

  // Same choice as getSubscriptionStatus: open-ended order first, then the one ending last.
  const currentOrder = new Map<string, (typeof activeOrders)[number]>();
  for (const order of activeOrders) {
    const best = currentOrder.get(order.companyId);
    const rank = (value: typeof order) => value.endsAt ? value.endsAt.getTime() : Number.POSITIVE_INFINITY;
    if (!best || rank(order) > rank(best) || (rank(order) === rank(best) && order.createdAt > best.createdAt)) currentOrder.set(order.companyId, order);
  }
  const hasOrders = new Set(orderedCompanies.map((row) => row.companyId));
  const employeesByCompany = new Map(employeeCounts.map((row) => [row.companyId, Number(row.value)]));

  const byIndustry = new Map<string, IndustryRow>();
  const empty = (industry: string): IndustryRow => ({ industry, companies: 0, paid: 0, trial: 0, expired: 0, untracked: 0, activeEmployees: 0, mrr: 0 });
  for (const industry of INDUSTRIES) byIndustry.set(industry, empty(industry));

  for (const company of companyRows) {
    const industry = company.industry?.trim() || "Lainnya";
    const row = byIndustry.get(industry) ?? byIndustry.set(industry, empty(industry)).get(industry)!;
    const order = currentOrder.get(company.id);
    const status = describeSubscription(order, hasOrders.has(company.id), now);
    row.companies += 1;
    row.activeEmployees += employeesByCompany.get(company.id) ?? 0;
    if (status.state === "untracked") row.untracked += 1;
    else if (status.state === "expired") row.expired += 1;
    else if (order && order.monthlyPrice > 0) { row.paid += 1; row.mrr += order.monthlyPrice; }
    else row.trial += 1;
  }

  const rows = [...byIndustry.values()].sort((a, b) => b.paid - a.paid || b.companies - a.companies || a.industry.localeCompare(b.industry));
  const totals = rows.reduce((sum, row) => ({
    companies: sum.companies + row.companies, paid: sum.paid + row.paid, trial: sum.trial + row.trial, expired: sum.expired + row.expired,
    untracked: sum.untracked + row.untracked, activeEmployees: sum.activeEmployees + row.activeEmployees, mrr: sum.mrr + row.mrr,
  }), { companies: 0, paid: 0, trial: 0, expired: 0, untracked: 0, activeEmployees: 0, mrr: 0 });
  return { rows, totals };
}
