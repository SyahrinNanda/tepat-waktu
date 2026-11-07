import { and, desc, eq, gt, ne } from "drizzle-orm";
import { db } from "@/db";
import { companies, subscriptionOrders, subscriptionPlans } from "@/db/schema";
import { periodEnd } from "@/features/subscriptions/plan-rules";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type ActivatableOrder = { id: string; companyId: string; planCode: string; durationMonths: number; durationDays: number };

/**
 * Activates a pending paid invoice: ends the company's other active order, starts this one and
 * switches the company plan. Renewing the same plan before it runs out continues from the current
 * end date, so no paid days are lost. Shared by manual verification and the Midtrans webhook.
 * Returns false when the invoice was no longer pending (already activated/rejected), so callers
 * can run it more than once safely.
 */
export async function activatePendingOrder(tx: Tx, order: ActivatableOrder, options: { verifiedBy: string | null; now?: Date; paid?: { at: Date; paymentType?: string | null; gatewayStatus?: string | null } }) {
  const now = options.now ?? new Date();
  const [running] = await tx.select({ endsAt: subscriptionOrders.endsAt }).from(subscriptionOrders).innerJoin(subscriptionPlans, eq(subscriptionOrders.planId, subscriptionPlans.id))
    .where(and(eq(subscriptionOrders.companyId, order.companyId), eq(subscriptionOrders.status, "active"), eq(subscriptionPlans.code, order.planCode), gt(subscriptionOrders.endsAt, now)))
    .orderBy(desc(subscriptionOrders.endsAt)).limit(1);
  const endsAt = periodEnd(running?.endsAt ?? now, order);

  const activated = await tx.update(subscriptionOrders).set({
    status: "active", verifiedBy: options.verifiedBy, verifiedAt: now, startedAt: now, endsAt,
    ...(options.paid ? { paidAt: options.paid.at, gatewayPaymentType: options.paid.paymentType ?? null, gatewayStatus: options.paid.gatewayStatus ?? null } : {}),
  }).where(and(eq(subscriptionOrders.id, order.id), eq(subscriptionOrders.status, "pending"))).returning({ id: subscriptionOrders.id });
  if (!activated.length) return false;

  await tx.update(subscriptionOrders).set({ status: "cancelled", cancelledAt: now })
    .where(and(eq(subscriptionOrders.companyId, order.companyId), eq(subscriptionOrders.status, "active"), ne(subscriptionOrders.id, order.id)));
  await tx.update(companies).set({ plan: order.planCode, updatedAt: now }).where(eq(companies.id, order.companyId));
  return true;
}
