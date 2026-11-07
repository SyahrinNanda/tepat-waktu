"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { couponRedemptions, subscriptionOrders, subscriptionPlans } from "@/db/schema";
import { requireSuperAdmin } from "@/lib/superadmin";
import { recordAudit } from "@/lib/audit";
import { activatePendingOrder } from "@/features/subscriptions/server/activate-order";
import { sendPaidInvoiceEmail } from "@/features/subscriptions/server/invoice-email";

export async function reviewSubscription(form: FormData) {
  const session = await requireSuperAdmin();
  const { orderId, decision } = z.object({ orderId: z.uuid(), decision: z.enum(["active", "rejected"]) }).parse(Object.fromEntries(form));
  const [order] = await db.select({ id: subscriptionOrders.id, invoiceNumber: subscriptionOrders.invoiceNumber, amount: subscriptionOrders.amount, planName: subscriptionPlans.name, companyId: subscriptionOrders.companyId, planCode: subscriptionPlans.code, durationMonths: subscriptionOrders.durationMonths, durationDays: subscriptionOrders.durationDays })
    .from(subscriptionOrders).innerJoin(subscriptionPlans, eq(subscriptionOrders.planId, subscriptionPlans.id))
    .where(and(eq(subscriptionOrders.id, orderId), eq(subscriptionOrders.status, "pending"))).limit(1);
  if (!order) throw new Error("Pengajuan tidak ditemukan atau sudah ditinjau.");
  const now = new Date();
  await db.transaction(async (tx) => {
    if (decision === "active") {
      if (!await activatePendingOrder(tx, order, { verifiedBy: session.user.id, now })) throw new Error("Pengajuan sudah ditinjau.");
    } else {
      const rejected = await tx.update(subscriptionOrders).set({ status: "rejected", verifiedBy: session.user.id, verifiedAt: now, startedAt: null, endsAt: null })
        .where(and(eq(subscriptionOrders.id, orderId), eq(subscriptionOrders.status, "pending"))).returning({ id: subscriptionOrders.id });
      if (!rejected.length) throw new Error("Pengajuan sudah ditinjau.");
      // A rejected invoice frees the coupon it used.
      await tx.delete(couponRedemptions).where(eq(couponRedemptions.orderId, order.id));
    }
    await recordAudit(session, {
      action: decision === "active" ? "payment.verify" : "payment.reject", companyId: order.companyId,
      summary: `${decision === "active" ? "Memverifikasi" : "Menolak"} pembayaran ${order.invoiceNumber} (Paket ${order.planName}, Rp ${order.amount.toLocaleString("id-ID")})`,
      metadata: { orderId: order.id, invoiceNumber: order.invoiceNumber, amount: order.amount },
    }, tx);
  });
  if (decision === "active") sendPaidInvoiceEmail(order.id);
  revalidatePath("/superadmin/langganan");
  revalidatePath("/dashboard/langganan");
}
