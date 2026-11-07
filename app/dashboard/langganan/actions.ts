"use server";

import { and, desc, eq, isNull, ne, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { companies, couponRedemptions, subscriptionOrders, subscriptionPlans } from "@/db/schema";
import { evaluateCoupon, normalizeCouponCode, type CouponCheck } from "@/features/subscriptions/server/coupons";
import { requireCompanyRole } from "@/lib/current-company";
import { DURATION_OPTIONS, ONLINE_PAYMENT_METHODS, paymentAdminFee, periodEnd, trialPeriod } from "@/features/subscriptions/plan-rules";
import { PaymentError, startMidtransPayment, syncInvoicePayment } from "@/features/subscriptions/server/midtrans-payments";
import { midtransConfig, MidtransError } from "@/lib/midtrans";

export type ActionState = {
  status: "idle" | "success" | "error";
  message: string;
  orderId?: string;
};

const durationSchema = z.coerce.number().int().refine((value) => (DURATION_OPTIONS as readonly number[]).includes(value), "Durasi paket tidak valid.");

function refreshSubscriptionPages() {
  revalidatePath("/dashboard/langganan");
  revalidatePath("/dashboard/langganan/paket");
  revalidatePath("/superadmin/langganan");
}

export async function requestSubscription(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const context = await requireCompanyRole(["admin"], { allowExpired: true });
  const parsed = z.object({ planId: z.uuid(), durationMonths: durationSchema, couponCode: z.string().max(40).optional() }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Data paket tidak valid." };
  const couponCode = normalizeCouponCode(parsed.data.couponCode ?? "");

  const [plan] = await db.select().from(subscriptionPlans).where(and(eq(subscriptionPlans.id, parsed.data.planId), eq(subscriptionPlans.active, true), or(isNull(subscriptionPlans.companyId), eq(subscriptionPlans.companyId, context.companyId)))).limit(1);
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

  const period = plan.monthlyPrice === 0 ? trialPeriod(plan) : { durationMonths: parsed.data.durationMonths, durationDays: 0 };
  const subtotal = plan.monthlyPrice * period.durationMonths;
  const now = new Date();
  let couponError: string | null = null;
  const [order] = await db.transaction(async (tx) => {
    // The coupon is re-checked under a row lock so a limited quota cannot be overspent.
    let coupon: CouponCheck | null = null;
    if (couponCode) {
      coupon = await evaluateCoupon({ code: couponCode, companyId: context.companyId, planCode: plan.code, durationMonths: period.durationMonths, subtotal }, { executor: tx, lock: true, now });
      if (!coupon.ok) { couponError = coupon.message; tx.rollback(); }
    }
    const discountAmount = coupon?.ok ? coupon.discount : 0;
    const amount = subtotal - discountAmount;
    const isFree = amount === 0;
    const [created] = await tx.insert(subscriptionOrders).values({
      companyId: context.companyId,
      planId: plan.id,
      invoiceNumber: `ATD-${now.toISOString().slice(0, 10).replaceAll("-", "")}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
      transactionType,
      ...period,
      subtotal,
      discountAmount,
      couponCode: coupon?.ok ? coupon.code : null,
      adminFee: 0,
      amount,
      status: isFree ? "active" : "pending",
      startedAt: isFree ? now : null,
      endsAt: isFree ? periodEnd(now, period) : null,
      requestedBy: context.session.user.id,
    }).returning({ id: subscriptionOrders.id, amount: subscriptionOrders.amount });
    if (coupon?.ok) await tx.insert(couponRedemptions).values({ couponId: coupon.couponId, companyId: context.companyId, orderId: created.id, discountAmount });
    if (isFree) await tx.update(companies).set({ plan: plan.code, updatedAt: now }).where(eq(companies.id, context.companyId));
    return [created];
  }).catch((error) => {
    if (couponError) return [null];
    throw error;
  });
  if (!order) return { status: "error", message: couponError ?? "Kupon tidak bisa dipakai." };

  refreshSubscriptionPages();
  return { status: "success", message: order.amount === 0 ? "Paket berhasil diaktifkan." : "Invoice berhasil dibuat.", orderId: order.id };
}

export type PaymentState = ActionState & {
  /** Snap token to open the Midtrans popup. */
  token?: string;
  redirectUrl?: string | null;
  /** The invoice turned out to be paid already. */
  paid?: boolean;
};

/**
 * "Bayar Sekarang": adds the admin fee of the chosen method and opens Midtrans Snap for it.
 * Without Midtrans keys (local development) the method is only recorded for manual verification.
 */
export async function requestPayment(_previous: PaymentState, formData: FormData): Promise<PaymentState> {
  const context = await requireCompanyRole(["admin"], { allowExpired: true });
  const parsed = z.object({ orderId: z.uuid(), paymentMethod: z.enum(ONLINE_PAYMENT_METHODS) }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", message: "Pilih metode pembayaran yang tersedia." };

  if (midtransConfig().configured) {
    try {
      const result = await startMidtransPayment({ orderId: parsed.data.orderId, companyId: context.companyId, method: parsed.data.paymentMethod, customer: { name: context.session.user.name, email: context.session.user.email } });
      refreshSubscriptionPages();
      if ("alreadyPaid" in result) return { status: "success", message: "Invoice ini sudah dibayar dan paket sudah aktif.", orderId: parsed.data.orderId, paid: true };
      return { status: "success", message: "Membuka halaman pembayaran Midtrans…", orderId: parsed.data.orderId, token: result.token, redirectUrl: result.redirectUrl };
    } catch (error) {
      if (error instanceof PaymentError || error instanceof MidtransError) {
        console.error("Midtrans payment start failed:", error.message);
        return { status: "error", message: error instanceof PaymentError ? error.message : "Halaman pembayaran belum bisa dibuka. Coba lagi beberapa saat lagi." };
      }
      throw error;
    }
  }

  const [order] = await db.select({ id: subscriptionOrders.id, subtotal: subscriptionOrders.subtotal, discountAmount: subscriptionOrders.discountAmount })
    .from(subscriptionOrders)
    .where(and(eq(subscriptionOrders.id, parsed.data.orderId), eq(subscriptionOrders.companyId, context.companyId), eq(subscriptionOrders.status, "pending")))
    .limit(1);
  if (!order) return { status: "error", message: "Invoice tidak ditemukan atau sudah diproses." };
  const adminFee = paymentAdminFee(parsed.data.paymentMethod, order.subtotal - order.discountAmount);
  await db.update(subscriptionOrders).set({
    paymentMethod: parsed.data.paymentMethod,
    paymentRequestedAt: new Date(),
    adminFee,
    amount: Math.max(0, order.subtotal - order.discountAmount + adminFee),
  }).where(and(eq(subscriptionOrders.id, order.id), eq(subscriptionOrders.companyId, context.companyId)));
  refreshSubscriptionPages();
  return { status: "success", message: "Pembayaran online belum aktif. Metode tersimpan dan pembayaran menunggu verifikasi admin.", orderId: order.id };
}

/** Asks Midtrans for the latest status of an invoice (after the popup closes). */
export async function checkPayment(orderId: string): Promise<{ paid: boolean }> {
  const context = await requireCompanyRole(["admin"], { allowExpired: true });
  const id = z.uuid().parse(orderId);
  await syncInvoicePayment(id, context.companyId);
  const [order] = await db.select({ status: subscriptionOrders.status }).from(subscriptionOrders)
    .where(and(eq(subscriptionOrders.id, id), eq(subscriptionOrders.companyId, context.companyId))).limit(1);
  refreshSubscriptionPages();
  return { paid: order?.status === "active" };
}

export async function cancelSubscription(): Promise<ActionState> {
  const context = await requireCompanyRole(["admin"], { allowExpired: true });
  const [fallbackPlan] = await db.select({ code: subscriptionPlans.code }).from(subscriptionPlans)
    .where(and(eq(subscriptionPlans.code, "free"), isNull(subscriptionPlans.companyId))).limit(1);

  const [activeOrder] = await db.select({ id: subscriptionOrders.id }).from(subscriptionOrders)
    .where(and(eq(subscriptionOrders.companyId, context.companyId), eq(subscriptionOrders.status, "active")))
    .orderBy(desc(subscriptionOrders.createdAt)).limit(1);
  const now = new Date();
  await db.transaction(async (tx) => {
    if (activeOrder) await tx.update(subscriptionOrders).set({ status: "cancelled", cancelledAt: now }).where(and(eq(subscriptionOrders.id, activeOrder.id), ne(subscriptionOrders.status, "cancelled")));
    await tx.update(companies).set({ plan: fallbackPlan?.code ?? "free", updatedAt: now }).where(eq(companies.id, context.companyId));
  });
  refreshSubscriptionPages();
  return { status: "success", message: "Langganan dihentikan. Pilih paket untuk membuka kembali akses perusahaan." };
}

export type CouponPreview = { status: "idle" | "valid" | "invalid"; message: string; discount?: number; total?: number; code?: string };

/** Lets the company admin check a coupon before creating the invoice. */
export async function previewCoupon(input: { planId: string; durationMonths: number; code: string }): Promise<CouponPreview> {
  const context = await requireCompanyRole(["admin"], { allowExpired: true });
  const parsed = z.object({ planId: z.uuid(), durationMonths: durationSchema, code: z.string().max(40) }).safeParse(input);
  if (!parsed.success) return { status: "invalid", message: "Pilih paket dan durasi terlebih dahulu." };
  const [plan] = await db.select().from(subscriptionPlans).where(and(eq(subscriptionPlans.id, parsed.data.planId), eq(subscriptionPlans.active, true), or(isNull(subscriptionPlans.companyId), eq(subscriptionPlans.companyId, context.companyId)))).limit(1);
  if (!plan) return { status: "invalid", message: "Paket tidak tersedia." };
  const subtotal = plan.monthlyPrice * parsed.data.durationMonths;
  const result = await evaluateCoupon({ code: parsed.data.code, companyId: context.companyId, planCode: plan.code, durationMonths: parsed.data.durationMonths, subtotal });
  if (!result.ok) return { status: "invalid", message: result.message };
  return { status: "valid", message: `Kupon ${result.code} (${result.label}) dipakai.`, discount: result.discount, total: subtotal - result.discount, code: result.code };
}
