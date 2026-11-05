"use server";

import { and, desc, eq, gt, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { companies, couponRedemptions, subscriptionOrders, subscriptionPlans } from "@/db/schema";
import { requireSuperAdmin } from "@/lib/superadmin";
import { periodEnd } from "@/features/subscriptions/plan-rules";
import { recordAudit } from "@/lib/audit";

export async function reviewSubscription(form: FormData) {
  const session = await requireSuperAdmin();
  const { orderId, decision } = z.object({ orderId: z.uuid(), decision: z.enum(["active", "rejected"]) }).parse(Object.fromEntries(form));
  const [order] = await db.select({ id: subscriptionOrders.id, invoiceNumber: subscriptionOrders.invoiceNumber, amount: subscriptionOrders.amount, planName: subscriptionPlans.name, companyId: subscriptionOrders.companyId, planCode: subscriptionPlans.code, durationMonths: subscriptionOrders.durationMonths, durationDays: subscriptionOrders.durationDays })
    .from(subscriptionOrders).innerJoin(subscriptionPlans, eq(subscriptionOrders.planId, subscriptionPlans.id))
    .where(and(eq(subscriptionOrders.id, orderId), eq(subscriptionOrders.status, "pending"))).limit(1);
  if (!order) throw new Error("Pengajuan tidak ditemukan atau sudah ditinjau.");
  const now = new Date();
  // Renewing the same plan before it runs out continues from the current end date, so no paid days are lost.
  const [running] = await db.select({ endsAt: subscriptionOrders.endsAt }).from(subscriptionOrders).innerJoin(subscriptionPlans, eq(subscriptionOrders.planId, subscriptionPlans.id))
    .where(and(eq(subscriptionOrders.companyId, order.companyId), eq(subscriptionOrders.status, "active"), eq(subscriptionPlans.code, order.planCode), gt(subscriptionOrders.endsAt, now)))
    .orderBy(desc(subscriptionOrders.endsAt)).limit(1);
  const startsAt = running?.endsAt ?? now;
  const endsAt = periodEnd(startsAt, order);
  await db.transaction(async (tx) => {
    if (decision === "active") {
      await tx.update(subscriptionOrders).set({ status: "cancelled", cancelledAt: now }).where(and(eq(subscriptionOrders.companyId, order.companyId), eq(subscriptionOrders.status, "active"), ne(subscriptionOrders.id, order.id)));
    }
    await tx.update(subscriptionOrders).set({ status: decision, verifiedBy: session.user.id, verifiedAt: now, startedAt: decision === "active" ? now : null, endsAt: decision === "active" ? endsAt : null }).where(and(eq(subscriptionOrders.id, orderId), eq(subscriptionOrders.status, "pending")));
    if (decision === "active") await tx.update(companies).set({ plan: order.planCode, updatedAt: now }).where(eq(companies.id, order.companyId));
    // A rejected invoice frees the coupon it used.
    if (decision === "rejected") await tx.delete(couponRedemptions).where(eq(couponRedemptions.orderId, order.id));
    await recordAudit(session, {
      action: decision === "active" ? "payment.verify" : "payment.reject", companyId: order.companyId,
      summary: `${decision === "active" ? "Memverifikasi" : "Menolak"} pembayaran ${order.invoiceNumber} (Paket ${order.planName}, Rp ${order.amount.toLocaleString("id-ID")})`,
      metadata: { orderId: order.id, invoiceNumber: order.invoiceNumber, amount: order.amount },
    }, tx);
  });
  revalidatePath("/superadmin/langganan");
  revalidatePath("/dashboard/langganan");
}
