import { and, count, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { companies, companyMembers, employees, subscriptionOrders, subscriptionPlans, subscriptionReminders, user } from "@/db/schema";
import { describeSubscription, type SubscriptionStatus } from "./subscription-status";

export type CompanySubscription = {
  id: string;
  name: string;
  industry: string;
  email: string | null;
  phone: string | null;
  createdAt: Date;
  status: SubscriptionStatus;
  /** Current active order (if any). */
  order: { id: string; planId: string; planName: string; planCode: string; monthlyPrice: number; maxEmployees: number; endsAt: Date | null } | null;
  /** For a locked company: the plan and date its access ended. */
  lastPlanName: string | null;
  lastPlanId: string | null;
  lastEndedAt: Date | null;
  activeEmployees: number;
  admins: { name: string; email: string }[];
  /** Reminder levels already emailed for the current order. */
  remindersSent: number[];
};

export function isTrial(company: CompanySubscription) {
  return company.order !== null && company.order.monthlyPrice === 0;
}

/** Every company with its current subscription, admins and usage — the basis of the retention list and reminders. */
export async function loadCompanySubscriptions(now = new Date(), onlyCompanyIds?: string[]): Promise<CompanySubscription[]> {
  const companyFilter = onlyCompanyIds ? inArray(companies.id, onlyCompanyIds) : undefined;
  const orderFilter = onlyCompanyIds ? inArray(subscriptionOrders.companyId, onlyCompanyIds) : undefined;
  if (onlyCompanyIds && !onlyCompanyIds.length) return [];
  const [companyRows, orders, adminRows, employeeCounts] = await Promise.all([
    db.select({ id: companies.id, name: companies.name, industry: companies.industry, email: companies.email, phone: companies.phone, whatsapp: companies.whatsapp, createdAt: companies.createdAt }).from(companies).where(companyFilter),
    db.select({
      id: subscriptionOrders.id, companyId: subscriptionOrders.companyId, status: subscriptionOrders.status, endsAt: subscriptionOrders.endsAt,
      cancelledAt: subscriptionOrders.cancelledAt, createdAt: subscriptionOrders.createdAt,
      planId: subscriptionPlans.id, planName: subscriptionPlans.name, planCode: subscriptionPlans.code, monthlyPrice: subscriptionPlans.monthlyPrice, maxEmployees: subscriptionPlans.maxEmployees,
    }).from(subscriptionOrders).innerJoin(subscriptionPlans, eq(subscriptionOrders.planId, subscriptionPlans.id)).where(orderFilter),
    db.select({ companyId: companyMembers.companyId, name: user.name, email: user.email }).from(companyMembers).innerJoin(user, eq(companyMembers.userId, user.id))
      .where(and(inArray(companyMembers.role, ["admin", "owner"]), onlyCompanyIds ? inArray(companyMembers.companyId, onlyCompanyIds) : undefined)),
    db.select({ companyId: employees.companyId, value: count() }).from(employees).where(and(eq(employees.status, "active"), onlyCompanyIds ? inArray(employees.companyId, onlyCompanyIds) : undefined)).groupBy(employees.companyId),
  ]);

  const byCompany = new Map<string, typeof orders>();
  for (const order of orders) (byCompany.get(order.companyId) ?? byCompany.set(order.companyId, []).get(order.companyId)!).push(order);
  const rank = (value: { endsAt: Date | null }) => value.endsAt ? value.endsAt.getTime() : Number.POSITIVE_INFINITY;

  const currentOrderIds: string[] = [];
  const result = companyRows.map((company) => {
    const list = byCompany.get(company.id) ?? [];
    let current: (typeof orders)[number] | undefined;
    for (const order of list) {
      if (order.status !== "active") continue;
      if (!current || rank(order) > rank(current) || (rank(order) === rank(current) && order.createdAt > current.createdAt)) current = order;
    }
    const status = describeSubscription(current ? { id: current.id, endsAt: current.endsAt, planName: current.planName } : undefined, list.length > 0, now);
    // When access has ended, show what they last had and when it stopped.
    let last: (typeof orders)[number] | undefined;
    let lastEnd: Date | null = null;
    if (status.state === "expired") {
      for (const order of list) {
        const ended = order.status === "active" ? order.endsAt : order.status === "cancelled" ? order.cancelledAt ?? order.endsAt : null;
        if (ended && (!lastEnd || ended > lastEnd)) { lastEnd = ended; last = order; }
      }
    }
    if (current) currentOrderIds.push(current.id);
    return {
      id: company.id, name: company.name, industry: company.industry, email: company.email, phone: company.whatsapp || company.phone, createdAt: company.createdAt,
      status,
      order: current && status.state === "active" ? { id: current.id, planId: current.planId, planName: current.planName, planCode: current.planCode, monthlyPrice: current.monthlyPrice, maxEmployees: current.maxEmployees, endsAt: current.endsAt } : null,
      lastPlanName: last?.planName ?? null,
      lastPlanId: last?.planId ?? null,
      lastEndedAt: lastEnd,
      activeEmployees: 0,
      admins: [] as { name: string; email: string }[],
      remindersSent: [] as number[],
    } satisfies CompanySubscription;
  });

  const reminders = currentOrderIds.length
    ? await db.select({ orderId: subscriptionReminders.orderId, level: subscriptionReminders.level }).from(subscriptionReminders)
      .where(and(inArray(subscriptionReminders.orderId, currentOrderIds), eq(subscriptionReminders.status, "sent")))
    : [];
  const employeesByCompany = new Map(employeeCounts.map((row) => [row.companyId, Number(row.value)]));
  const adminsByCompany = new Map<string, { name: string; email: string }[]>();
  for (const admin of adminRows) (adminsByCompany.get(admin.companyId) ?? adminsByCompany.set(admin.companyId, []).get(admin.companyId)!).push({ name: admin.name, email: admin.email });
  for (const company of result) {
    company.activeEmployees = employeesByCompany.get(company.id) ?? 0;
    company.admins = adminsByCompany.get(company.id) ?? [];
    company.remindersSent = reminders.filter((row) => row.orderId === company.status.orderId).map((row) => row.level).sort((a, b) => b - a);
  }
  return result;
}

/** Reminder emails go only to the company admin accounts (the registering account and any other admins). */
export function reminderRecipients(company: CompanySubscription) {
  const emails = company.admins.map((admin) => admin.email).map((value) => value.trim().toLowerCase()).filter((value) => /.+@.+\..+/.test(value));
  return [...new Set(emails)];
}
