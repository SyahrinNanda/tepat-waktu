import { cache } from "react";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { subscriptionOrders, subscriptionPlans } from "@/db/schema";

/** Warnings are shown from 5 days before expiry, escalating at 2 days. */
export const WARNING_DAYS = [5, 2] as const;
const DAY_MS = 86_400_000;

export type SubscriptionStatus = {
  /** "untracked" = legacy company that never had an order; it is not blocked. */
  state: "active" | "expired" | "untracked";
  endsAt: string | null;
  daysLeft: number | null;
  warning: 5 | 2 | null;
  planName: string | null;
  orderId: string | null;
};

export function describeSubscription(order: { id: string; endsAt: Date | null; planName: string } | undefined, hasAnyOrder: boolean, now = new Date()): SubscriptionStatus {
  if (!order) return { state: hasAnyOrder ? "expired" : "untracked", endsAt: null, daysLeft: null, warning: null, planName: null, orderId: null };
  const base = { endsAt: order.endsAt?.toISOString() ?? null, planName: order.planName, orderId: order.id };
  if (!order.endsAt) return { ...base, state: "active", daysLeft: null, warning: null };
  const remaining = order.endsAt.getTime() - now.getTime();
  if (remaining <= 0) return { ...base, state: "expired", daysLeft: 0, warning: null };
  const daysLeft = Math.ceil(remaining / DAY_MS);
  const warning = daysLeft <= WARNING_DAYS[1] ? 2 : daysLeft <= WARNING_DAYS[0] ? 5 : null;
  return { ...base, state: "active", daysLeft, warning };
}

/** Current subscription of a company, memoised per request. */
export const getSubscriptionStatus = cache(async (companyId: string): Promise<SubscriptionStatus> => {
  const [[order], [any]] = await Promise.all([
    db.select({ id: subscriptionOrders.id, endsAt: subscriptionOrders.endsAt, planName: subscriptionPlans.name })
      .from(subscriptionOrders).innerJoin(subscriptionPlans, eq(subscriptionOrders.planId, subscriptionPlans.id))
      .where(and(eq(subscriptionOrders.companyId, companyId), eq(subscriptionOrders.status, "active")))
      // An open-ended order wins, then the one that runs longest.
      .orderBy(sql`${subscriptionOrders.endsAt} desc nulls first`, desc(subscriptionOrders.createdAt)).limit(1),
    db.select({ id: subscriptionOrders.id }).from(subscriptionOrders).where(eq(subscriptionOrders.companyId, companyId)).limit(1),
  ]);
  return describeSubscription(order, Boolean(any));
});

export const SUBSCRIPTION_EXPIRED_MESSAGE = "Masa aktif paket perusahaan telah berakhir. Perpanjang atau pilih paket baru untuk melanjutkan.";

/** For API handlers: a 402 response when the company may not use the app, otherwise null. */
export async function subscriptionBlock(companyId: string) {
  const status = await getSubscriptionStatus(companyId);
  return status.state === "expired" ? Response.json({ error: SUBSCRIPTION_EXPIRED_MESSAGE, code: "subscription_expired" }, { status: 402 }) : null;
}
