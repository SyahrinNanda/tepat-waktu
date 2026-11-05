import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { companies, companyMembers, couponRedemptions, registrationRequests, subscriptionOrders, subscriptionPlans, user } from "@/db/schema";
import { DURATION_OPTIONS, periodEnd, trialPeriod } from "@/features/subscriptions/plan-rules";
import { evaluateCoupon, normalizeCouponCode } from "@/features/subscriptions/server/coupons";

export const REGISTRATION_INDUSTRIES = ["Teknologi", "Pemerintahan", "F&B", "Jasa", "Media", "Lainnya"] as const;

export type RegistrationData = { companyName: string; industry: string; planCode: string; durationMonths?: number; couponCode?: string | null };

/** Stores the sign-up form until the email is verified (replaces an earlier unverified attempt). */
export async function saveRegistrationRequest(userId: string, data: RegistrationData) {
  const durationMonths = (DURATION_OPTIONS as readonly number[]).includes(data.durationMonths ?? 1) ? data.durationMonths ?? 1 : 1;
  const couponCode = data.couponCode ? normalizeCouponCode(data.couponCode).slice(0, 40) || null : null;
  const values = { userId, companyName: data.companyName.trim(), industry: data.industry, planCode: data.planCode, durationMonths, couponCode };
  await db.insert(registrationRequests).values(values).onConflictDoUpdate({ target: registrationRequests.userId, set: { ...values, createdAt: new Date() } });
}

/**
 * Creates the company, admin membership and first subscription orders for a verified account that
 * signed up through the public form. Idempotent and safe to call concurrently: it runs after email
 * verification and again on the first login as a safety net.
 */
export async function provisionRegistration(userId: string): Promise<{ created: boolean }> {
  const [account] = await db.select({ id: user.id, email: user.email, emailVerified: user.emailVerified }).from(user).where(eq(user.id, userId)).limit(1);
  if (!account?.emailVerified) return { created: false };

  return db.transaction(async (tx) => {
    // Row lock: a second concurrent call waits here and then finds the request gone.
    const [request] = await tx.select().from(registrationRequests).where(eq(registrationRequests.userId, userId)).for("update");
    if (!request) return { created: false };
    const [membership] = await tx.select({ id: companyMembers.id }).from(companyMembers).where(eq(companyMembers.userId, userId)).limit(1);
    if (membership) { await tx.delete(registrationRequests).where(eq(registrationRequests.userId, userId)); return { created: false }; }

    const publicPlan = (code: string) => tx.select().from(subscriptionPlans).where(and(eq(subscriptionPlans.code, code), eq(subscriptionPlans.active, true), isNull(subscriptionPlans.companyId))).limit(1);
    const [freePlan] = await tx.select().from(subscriptionPlans).where(and(eq(subscriptionPlans.monthlyPrice, 0), eq(subscriptionPlans.active, true), isNull(subscriptionPlans.companyId))).limit(1);
    // A plan retired between sign-up and verification falls back to the free trial.
    const plan = (await publicPlan(request.planCode))[0] ?? freePlan;
    if (!plan) throw new Error("Tidak ada paket aktif untuk pendaftaran.");

    const now = new Date();
    const isFree = plan.monthlyPrice === 0;
    const period = isFree ? trialPeriod(plan) : { durationMonths: request.durationMonths, durationDays: 0 };
    const subtotal = plan.monthlyPrice * period.durationMonths;
    const invoiceNumber = () => `REG-${now.toISOString().slice(0, 10).replaceAll("-", "")}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;

    const [company] = await tx.insert(companies).values({ name: request.companyName, email: account.email, industry: request.industry, plan: isFree || !freePlan ? plan.code : freePlan.code }).returning({ id: companies.id });
    await tx.insert(companyMembers).values({ companyId: company.id, userId, role: "admin" });

    // Coupon re-checked under a row lock. If it became invalid since the preview (quota used up,
    // expired), registration still succeeds and the invoice is created at full price.
    const coupon = !isFree && request.couponCode
      ? await evaluateCoupon({ code: request.couponCode, companyId: company.id, planCode: plan.code, durationMonths: period.durationMonths, subtotal }, { executor: tx, lock: true, now })
      : null;
    const discountAmount = coupon?.ok ? coupon.discount : 0;
    const amount = subtotal - discountAmount;
    // Paid plan fully covered by a coupon: active right away, no trial or payment needed.
    const activeNow = isFree || amount === 0;

    if (!isFree && !activeNow && freePlan) {
      const freePeriod = trialPeriod(freePlan);
      await tx.insert(subscriptionOrders).values({ companyId: company.id, planId: freePlan.id, invoiceNumber: invoiceNumber(), transactionType: "new", ...freePeriod, subtotal: 0, amount: 0, status: "active", startedAt: now, endsAt: periodEnd(now, freePeriod), requestedBy: userId });
    }
    const [order] = await tx.insert(subscriptionOrders).values({
      companyId: company.id, planId: plan.id, invoiceNumber: invoiceNumber(), transactionType: "new", ...period,
      subtotal, discountAmount, couponCode: coupon?.ok ? coupon.code : null, amount,
      status: activeNow ? "active" : "pending", startedAt: activeNow ? now : null, endsAt: activeNow ? periodEnd(now, period) : null, requestedBy: userId,
    }).returning({ id: subscriptionOrders.id });
    if (coupon?.ok) await tx.insert(couponRedemptions).values({ couponId: coupon.couponId, companyId: company.id, orderId: order.id, discountAmount });
    if (!isFree && activeNow) await tx.update(companies).set({ plan: plan.code, updatedAt: now }).where(eq(companies.id, company.id));
    await tx.delete(registrationRequests).where(eq(registrationRequests.userId, userId));
    return { created: true };
  });
}
