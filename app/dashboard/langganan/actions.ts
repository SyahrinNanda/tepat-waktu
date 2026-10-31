"use server";

import { and, desc, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { companies, subscriptionOrders, subscriptionPlans } from "@/db/schema";
import { requireCompanyRole } from "@/lib/current-company";

export type ActionState = {
  status: "idle" | "success" | "error";
  message: string;
  orderId?: string;
};

const durationSchema = z.coerce.number().int().refine((value) => [1, 3, 6, 8, 12].includes(value), "Durasi paket tidak valid.");
const paymentFees: Record<string, (subtotal: number) => number> = {
  credit_card: (subtotal) => Math.round(subtotal * 0.036),
  bank_transfer: () => 4_000,
  shopeepay: (subtotal) => Math.round(subtotal * 0.015),
  indomaret: () => 5_000,
  alfamart: () => 5_000,
  akulaku: (subtotal) => Math.round(subtotal * 0.02),
  qris: (subtotal) => Math.round(subtotal * 0.007),
};

function addMonths(date: Date, months: number) {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

function refreshSubscriptionPages() {
  revalidatePath("/dashboard/langganan");
  revalidatePath("/dashboard/langganan/paket");
  revalidatePath("/superadmin/langganan");
}

export async function requestSubscription(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const context = await requireCompanyRole(["admin"]);
  const parsed = z.object({ planId: z.uuid(), durationMonths: durationSchema }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Data paket tidak valid." };

  const [plan] = await db.select().from(subscriptionPlans).where(and(eq(subscriptionPlans.id, parsed.data.planId), eq(subscriptionPlans.active, true))).limit(1);
  if (!plan) return { status: "error", message: "Paket tidak tersedia." };

  const [currentPlan] = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.code, context.plan)).limit(1);
  const transactionType = currentPlan?.id === plan.id ? "renewal" : currentPlan ? "upgrade" : "new";
  const previousOrders = await db.select({ status: subscriptionOrders.status }).from(subscriptionOrders)
    .where(and(eq(subscriptionOrders.companyId, context.companyId), eq(subscriptionOrders.planId, plan.id)));

  if (previousOrders.some((order) => order.status === "pending")) {
    return { status: "error", message: "Pengajuan paket ini masih menunggu pembayaran atau verifikasi." };
  }
  if (plan.monthlyPrice === 0 && previousOrders.some((order) => order.status !== "rejected")) {
    return { status: "error", message: "Paket demo hanya bisa digunakan satu kali!" };
  }

  const durationMonths = plan.monthlyPrice === 0 && plan.trialMonths > 0 ? plan.trialMonths : parsed.data.durationMonths;
  const subtotal = plan.monthlyPrice * durationMonths;
  const now = new Date();
  const isFree = subtotal === 0;
  const [order] = await db.transaction(async (tx) => {
    const [created] = await tx.insert(subscriptionOrders).values({
      companyId: context.companyId,
      planId: plan.id,
      invoiceNumber: `ATD-${now.toISOString().slice(0, 10).replaceAll("-", "")}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
      transactionType,
      durationMonths,
      subtotal,
      discountAmount: 0,
      adminFee: 0,
      amount: subtotal,
      status: isFree ? "active" : "pending",
      startedAt: isFree ? now : null,
      endsAt: isFree ? addMonths(now, durationMonths) : null,
      requestedBy: context.session.user.id,
    }).returning({ id: subscriptionOrders.id });
    if (isFree) await tx.update(companies).set({ plan: plan.code, updatedAt: now }).where(eq(companies.id, context.companyId));
    return [created];
  });

  refreshSubscriptionPages();
  return { status: "success", message: isFree ? "Paket berhasil diaktifkan." : "Invoice berhasil dibuat.", orderId: order.id };
}

export async function requestPayment(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const context = await requireCompanyRole(["admin"]);
  const parsed = z.object({ orderId: z.uuid(), paymentMethod: z.enum(["credit_card", "bank_transfer", "shopeepay", "indomaret", "alfamart", "akulaku", "qris"]) }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", message: "Pilih metode pembayaran yang tersedia." };

  const [order] = await db.select({ id: subscriptionOrders.id, subtotal: subscriptionOrders.subtotal, discountAmount: subscriptionOrders.discountAmount })
    .from(subscriptionOrders)
    .where(and(eq(subscriptionOrders.id, parsed.data.orderId), eq(subscriptionOrders.companyId, context.companyId), eq(subscriptionOrders.status, "pending")))
    .limit(1);
  if (!order) return { status: "error", message: "Invoice tidak ditemukan atau sudah diproses." };

  const adminFee = paymentFees[parsed.data.paymentMethod](order.subtotal);
  await db.update(subscriptionOrders).set({
    paymentMethod: parsed.data.paymentMethod,
    paymentRequestedAt: new Date(),
    adminFee,
    amount: Math.max(0, order.subtotal - order.discountAmount + adminFee),
  }).where(and(eq(subscriptionOrders.id, order.id), eq(subscriptionOrders.companyId, context.companyId)));
  refreshSubscriptionPages();
  return { status: "success", message: "Metode pembayaran tersimpan. Pembayaran menunggu verifikasi admin.", orderId: order.id };
}

export async function cancelSubscription(): Promise<ActionState> {
  const context = await requireCompanyRole(["admin"]);
  const [fallbackPlan] = await db.select({ code: subscriptionPlans.code }).from(subscriptionPlans)
    .where(and(eq(subscriptionPlans.active, true), eq(subscriptionPlans.code, "free"))).limit(1);

  const [activeOrder] = await db.select({ id: subscriptionOrders.id }).from(subscriptionOrders)
    .where(and(eq(subscriptionOrders.companyId, context.companyId), eq(subscriptionOrders.status, "active")))
    .orderBy(desc(subscriptionOrders.createdAt)).limit(1);
  const now = new Date();
  await db.transaction(async (tx) => {
    if (activeOrder) await tx.update(subscriptionOrders).set({ status: "cancelled", cancelledAt: now }).where(and(eq(subscriptionOrders.id, activeOrder.id), ne(subscriptionOrders.status, "cancelled")));
    await tx.update(companies).set({ plan: fallbackPlan?.code ?? "free", updatedAt: now }).where(eq(companies.id, context.companyId));
  });
  refreshSubscriptionPages();
  return { status: "success", message: "Langganan berhasil dihentikan. Perusahaan dialihkan ke paket gratis." };
}
