"use server";

import { and, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { companies, subscriptionOrders, subscriptionPlans } from "@/db/schema";
import { requireSuperAdmin } from "@/lib/superadmin";

export async function reviewSubscription(form: FormData) {
  const session = await requireSuperAdmin();
  const { orderId, decision } = z.object({ orderId: z.uuid(), decision: z.enum(["active", "rejected"]) }).parse(Object.fromEntries(form));
  const [order] = await db.select({ id: subscriptionOrders.id, companyId: subscriptionOrders.companyId, planCode: subscriptionPlans.code, durationMonths: subscriptionOrders.durationMonths })
    .from(subscriptionOrders).innerJoin(subscriptionPlans, eq(subscriptionOrders.planId, subscriptionPlans.id))
    .where(and(eq(subscriptionOrders.id, orderId), eq(subscriptionOrders.status, "pending"))).limit(1);
  if (!order) throw new Error("Pengajuan tidak ditemukan atau sudah ditinjau.");
  const now = new Date();
  const endsAt = new Date(now);
  endsAt.setMonth(endsAt.getMonth() + order.durationMonths);
  await db.transaction(async (tx) => {
    if (decision === "active") {
      await tx.update(subscriptionOrders).set({ status: "cancelled", cancelledAt: now }).where(and(eq(subscriptionOrders.companyId, order.companyId), eq(subscriptionOrders.status, "active"), ne(subscriptionOrders.id, order.id)));
    }
    await tx.update(subscriptionOrders).set({ status: decision, verifiedBy: session.user.id, verifiedAt: now, startedAt: decision === "active" ? now : null, endsAt: decision === "active" ? endsAt : null }).where(and(eq(subscriptionOrders.id, orderId), eq(subscriptionOrders.status, "pending")));
    if (decision === "active") await tx.update(companies).set({ plan: order.planCode, updatedAt: now }).where(eq(companies.id, order.companyId));
  });
  revalidatePath("/superadmin/langganan");
  revalidatePath("/dashboard/langganan");
}
