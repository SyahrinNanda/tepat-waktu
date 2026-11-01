import { and, eq } from "drizzle-orm";
import type { User } from "@supabase/supabase-js";
import { db } from "@/db";
import { companies, companyMembers, subscriptionOrders, subscriptionPlans, user } from "@/db/schema";

const industries = ["Teknologi", "Pemerintahan", "F&B", "Jasa", "Media", "Lainnya"];

export async function provisionSupabaseRegistration(identity: User) {
  if (!identity.email || !identity.email_confirmed_at) throw new Error("Email belum diverifikasi.");
  const email = identity.email.toLowerCase();
  const existing = await db.select({ id: user.id }).from(user).where(eq(user.email, email)).limit(1);
  if (existing.length) return { created: false };

  const data = identity.user_metadata ?? {};
  const companyName = typeof data.companyName === "string" ? data.companyName.trim() : "";
  const name = typeof data.name === "string" ? data.name.trim() : email.split("@")[0];
  const industry = typeof data.industry === "string" ? data.industry : "";
  const planCode = typeof data.plan === "string" ? data.plan : "";
  if (companyName.length < 2 || companyName.length > 120 || name.length < 2 || name.length > 120 || !industries.includes(industry)) {
    return { created: false, needsCompany: true };
  }
  const [plan] = await db.select().from(subscriptionPlans).where(and(eq(subscriptionPlans.code, planCode), eq(subscriptionPlans.active, true))).limit(1);
  const [freePlan] = await db.select().from(subscriptionPlans).where(and(eq(subscriptionPlans.monthlyPrice, 0), eq(subscriptionPlans.active, true))).limit(1);
  if (!plan || (plan.monthlyPrice > 0 && !freePlan)) return { created: false, needsCompany: true };

  const created = await db.transaction(async (tx) => {
    const inserted = await tx.insert(user).values({ id: identity.id, name, email, emailVerified: true }).onConflictDoNothing().returning({ id: user.id });
    if (!inserted.length) return false;
    const [company] = await tx.insert(companies).values({ name: companyName, email, industry, plan: plan.monthlyPrice === 0 ? plan.code : freePlan!.code }).returning({ id: companies.id });
    await tx.insert(companyMembers).values({ companyId: company.id, userId: identity.id, role: "admin" });
    const now = new Date();
    const isFree = plan.monthlyPrice === 0;
    const durationMonths = isFree ? Math.max(plan.trialMonths, 1) : 1;
    const endsAt = isFree ? new Date(now) : null;
    if (endsAt) endsAt.setMonth(endsAt.getMonth() + durationMonths);
    if (!isFree && freePlan) {
      const freeEndsAt = new Date(now);
      const freeDuration = Math.max(freePlan.trialMonths, 1);
      freeEndsAt.setMonth(freeEndsAt.getMonth() + freeDuration);
      await tx.insert(subscriptionOrders).values({ companyId: company.id, planId: freePlan.id, invoiceNumber: `REG-${now.toISOString().slice(0, 10).replaceAll("-", "")}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`, transactionType: "new", durationMonths: freeDuration, subtotal: 0, amount: 0, status: "active", startedAt: now, endsAt: freeEndsAt, requestedBy: identity.id });
    }
    await tx.insert(subscriptionOrders).values({ companyId: company.id, planId: plan.id, invoiceNumber: `REG-${now.toISOString().slice(0, 10).replaceAll("-", "")}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`, transactionType: "new", durationMonths, subtotal: plan.monthlyPrice * durationMonths, amount: plan.monthlyPrice * durationMonths, status: isFree ? "active" : "pending", startedAt: isFree ? now : null, endsAt, requestedBy: identity.id });
    return true;
  });
  return { created };
}
