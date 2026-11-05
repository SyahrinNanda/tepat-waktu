import { and, eq, gte, isNull } from "drizzle-orm";
import { db } from "@/db";
import { companies, subscriptionOrders, subscriptionPlans } from "@/db/schema";
import { lastTwelveMonths } from "./revenue-report";

const TIME_ZONE = "Asia/Makassar";
const DAY_MS = 86_400_000;
const monthKey = (value: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit" }).format(value).slice(0, 7);
const monthLabel = (key: string) => new Intl.DateTimeFormat("id-ID", { month: "short", year: "2-digit", timeZone: "UTC" }).format(new Date(`${key}-15T00:00:00Z`));

export type Cohort = {
  key: string; label: string;
  registered: number; trialStarted: number; paid: number;
  stillTrial: number; stoppedWithoutPaying: number; stoppedAfterPaying: number; paidActive: number;
  /** Trials that have ended, i.e. the company has had to decide. */
  trialsDecided: number; paidFromTrial: number;
};

export type TrialFunnel = {
  trialDays: number;
  cohorts: Cohort[];
  totals: Omit<Cohort, "key" | "label">;
  /** How long paying companies took from registration to their first verified payment. */
  timeToPay: { label: string; count: number }[];
  medianDaysToPay: number | null;
};

/** Registration cohorts of the last 12 months and what each company did with its trial. */
export async function getTrialFunnel(now = new Date()): Promise<TrialFunnel> {
  const keys = lastTwelveMonths(now);
  const since = new Date(`${keys[0]}-01T00:00:00+08:00`);
  const [companyRows, orders, [freePlan]] = await Promise.all([
    db.select({ id: companies.id, createdAt: companies.createdAt }).from(companies).where(gte(companies.createdAt, since)),
    db.select({
      companyId: subscriptionOrders.companyId, status: subscriptionOrders.status, amount: subscriptionOrders.amount, verifiedAt: subscriptionOrders.verifiedAt,
      startedAt: subscriptionOrders.startedAt, endsAt: subscriptionOrders.endsAt, monthlyPrice: subscriptionPlans.monthlyPrice,
    }).from(subscriptionOrders).innerJoin(subscriptionPlans, eq(subscriptionOrders.planId, subscriptionPlans.id))
      .innerJoin(companies, eq(subscriptionOrders.companyId, companies.id)).where(gte(companies.createdAt, since)),
    db.select({ trialDays: subscriptionPlans.trialDays }).from(subscriptionPlans).where(and(eq(subscriptionPlans.code, "free"), isNull(subscriptionPlans.companyId))).limit(1),
  ]);
  const trialDays = freePlan?.trialDays || 14;

  const ordersByCompany = new Map<string, typeof orders>();
  for (const order of orders) (ordersByCompany.get(order.companyId) ?? ordersByCompany.set(order.companyId, []).get(order.companyId)!).push(order);

  const empty = (key: string): Cohort => ({ key, label: monthLabel(key), registered: 0, trialStarted: 0, paid: 0, stillTrial: 0, stoppedWithoutPaying: 0, stoppedAfterPaying: 0, paidActive: 0, trialsDecided: 0, paidFromTrial: 0 });
  const cohorts = new Map(keys.map((key) => [key, empty(key)]));
  const daysToPay: number[] = [];

  for (const company of companyRows) {
    const cohort = cohorts.get(monthKey(company.createdAt));
    if (!cohort) continue;
    const list = ordersByCompany.get(company.id) ?? [];
    const trial = list.find((order) => order.monthlyPrice === 0 && order.status !== "rejected" && order.startedAt);
    const payments = list.filter((order) => order.amount > 0 && order.verifiedAt && order.status !== "rejected" && order.status !== "pending");
    const firstPaid = payments.reduce<Date | null>((min, order) => !min || order.verifiedAt! < min ? order.verifiedAt! : min, null);
    const live = list.filter((order) => order.status === "active" && (!order.endsAt || order.endsAt > now));
    const livePaid = live.some((order) => order.monthlyPrice > 0);
    const liveTrial = live.some((order) => order.monthlyPrice === 0);

    cohort.registered += 1;
    if (trial) cohort.trialStarted += 1;
    if (firstPaid) {
      cohort.paid += 1;
      daysToPay.push(Math.max(0, (firstPaid.getTime() - company.createdAt.getTime()) / DAY_MS));
      if (livePaid) cohort.paidActive += 1; else cohort.stoppedAfterPaying += 1;
    } else if (liveTrial) cohort.stillTrial += 1;
    else cohort.stoppedWithoutPaying += 1;
    // Conversion is judged only once the trial is over (or the company already paid).
    if (trial && (firstPaid || (trial.endsAt && trial.endsAt <= now))) {
      cohort.trialsDecided += 1;
      if (firstPaid) cohort.paidFromTrial += 1;
    }
  }

  const list = [...cohorts.values()];
  const totals = list.reduce((sum, row) => {
    for (const key of Object.keys(sum) as (keyof typeof sum)[]) sum[key] += row[key];
    return sum;
  }, { registered: 0, trialStarted: 0, paid: 0, stillTrial: 0, stoppedWithoutPaying: 0, stoppedAfterPaying: 0, paidActive: 0, trialsDecided: 0, paidFromTrial: 0 });

  const buckets = [
    { label: `Selama trial (≤ ${trialDays} hari)`, test: (days: number) => days <= trialDays },
    { label: `${trialDays + 1}–30 hari`, test: (days: number) => days > trialDays && days <= 30 },
    { label: "31–60 hari", test: (days: number) => days > 30 && days <= 60 },
    { label: "> 60 hari", test: (days: number) => days > 60 },
  ];
  const sorted = [...daysToPay].sort((a, b) => a - b);
  const median = sorted.length ? sorted.length % 2 ? sorted[(sorted.length - 1) / 2] : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2 : null;
  return {
    trialDays,
    cohorts: list,
    totals,
    timeToPay: buckets.map((bucket) => ({ label: bucket.label, count: daysToPay.filter(bucket.test).length })),
    medianDaysToPay: median === null ? null : Math.round(median),
  };
}
