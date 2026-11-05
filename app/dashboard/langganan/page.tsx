import type { Metadata } from "next";
import { and, asc, count, desc, eq, isNull, or } from "drizzle-orm";
import { db } from "@/db";
import { employees, subscriptionOrders, subscriptionPlans } from "@/db/schema";
import { redirect } from "next/navigation";
import { requireCompany, SUBSCRIPTION_LOCKED_PATH } from "@/lib/current-company";
import { SubscriptionManager } from "./subscription-manager";

export const metadata: Metadata = { title: "Langganan" };

export default async function Page({ searchParams }: { searchParams: Promise<{ invoice?: string }> }) {
  const context = await requireCompany({ allowExpired: true });
  // Only the company admin renews; other members whose access ended go to the locked page.
  if (context.subscription.state === "expired" && !context.isSuperAdmin && context.role !== "admin" && context.role !== "owner") redirect(SUBSCRIPTION_LOCKED_PATH);
  const { invoice } = await searchParams;
  const [plans, [ownPlan], orders, [employeeTotal]] = await Promise.all([
    db.select().from(subscriptionPlans).where(and(eq(subscriptionPlans.active, true), or(isNull(subscriptionPlans.companyId), eq(subscriptionPlans.companyId, context.companyId)))).orderBy(asc(subscriptionPlans.monthlyPrice), asc(subscriptionPlans.maxEmployees)),
    // The company may still sit on a tier that is no longer sold; show it as-is.
    db.select().from(subscriptionPlans).where(eq(subscriptionPlans.code, context.plan)).limit(1),
    db.select({
      id: subscriptionOrders.id,
      invoiceNumber: subscriptionOrders.invoiceNumber,
      amount: subscriptionOrders.amount,
      subtotal: subscriptionOrders.subtotal,
      discountAmount: subscriptionOrders.discountAmount,
      couponCode: subscriptionOrders.couponCode,
      adminFee: subscriptionOrders.adminFee,
      status: subscriptionOrders.status,
      paymentMethod: subscriptionOrders.paymentMethod,
      durationMonths: subscriptionOrders.durationMonths,
      durationDays: subscriptionOrders.durationDays,
      transactionType: subscriptionOrders.transactionType,
      createdAt: subscriptionOrders.createdAt,
      endsAt: subscriptionOrders.endsAt,
      planCode: subscriptionPlans.code,
      planName: subscriptionPlans.name,
    }).from(subscriptionOrders).innerJoin(subscriptionPlans, eq(subscriptionOrders.planId, subscriptionPlans.id))
      .where(eq(subscriptionOrders.companyId, context.companyId)).orderBy(desc(subscriptionOrders.createdAt)),
    db.select({ value: count() }).from(employees).where(and(eq(employees.companyId, context.companyId), eq(employees.status, "active"))),
  ]);
  const currentPlan = ownPlan ?? plans.find((plan) => plan.code === "free") ?? plans[0];
  if (!currentPlan) return <section className="module-card empty-state">Belum ada paket aktif yang tersedia.</section>;
  const recommendedPlan = plans.find((plan) => plan.monthlyPrice > currentPlan.monthlyPrice && plan.maxEmployees > currentPlan.maxEmployees && plan.companyId === null) ?? null;
  const activeOrder = orders.find((order) => order.status === "active" && order.planCode === currentPlan.code);

  return <div className="subscription-reference-page">
    <header className="subscription-reference-header"><small>TepatWaktu Admin Panel</small><h1>LANGGANAN</h1><nav><span>Beranda</span><b>/</b><strong>Langganan</strong></nav></header>
    <SubscriptionManager
      companyName={context.companyName}
      timezone={context.timezone}
      currentPlan={currentPlan}
      recommendedPlan={recommendedPlan}
      employeeCount={employeeTotal?.value ?? 0}
      expiresAt={activeOrder?.endsAt?.toISOString() ?? null}
      orders={orders.map((order) => ({ ...order, createdAt: order.createdAt.toISOString() }))}
      canManage={context.role === "admin" || context.role === "owner"}
      initialInvoiceId={invoice}
    />
  </div>;
}
