import type { Metadata } from "next";
import { and, asc, count, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { employees, subscriptionOrders, subscriptionPlans } from "@/db/schema";
import { requireCompany } from "@/lib/current-company";
import { SubscriptionManager } from "./subscription-manager";

export const metadata: Metadata = { title: "Langganan" };

export default async function Page({ searchParams }: { searchParams: Promise<{ invoice?: string }> }) {
  const context = await requireCompany();
  const { invoice } = await searchParams;
  const [plans, orders, [employeeTotal]] = await Promise.all([
    db.select().from(subscriptionPlans).where(eq(subscriptionPlans.active, true)).orderBy(asc(subscriptionPlans.monthlyPrice), asc(subscriptionPlans.maxEmployees)),
    db.select({
      id: subscriptionOrders.id,
      invoiceNumber: subscriptionOrders.invoiceNumber,
      amount: subscriptionOrders.amount,
      subtotal: subscriptionOrders.subtotal,
      discountAmount: subscriptionOrders.discountAmount,
      adminFee: subscriptionOrders.adminFee,
      status: subscriptionOrders.status,
      paymentMethod: subscriptionOrders.paymentMethod,
      durationMonths: subscriptionOrders.durationMonths,
      transactionType: subscriptionOrders.transactionType,
      createdAt: subscriptionOrders.createdAt,
      endsAt: subscriptionOrders.endsAt,
      planCode: subscriptionPlans.code,
      planName: subscriptionPlans.name,
    }).from(subscriptionOrders).innerJoin(subscriptionPlans, eq(subscriptionOrders.planId, subscriptionPlans.id))
      .where(eq(subscriptionOrders.companyId, context.companyId)).orderBy(desc(subscriptionOrders.createdAt)),
    db.select({ value: count() }).from(employees).where(and(eq(employees.companyId, context.companyId), eq(employees.status, "active"))),
  ]);
  const currentPlan = plans.find((plan) => plan.code === context.plan) ?? plans.find((plan) => plan.code === "free") ?? plans[0];
  if (!currentPlan) return <section className="module-card empty-state">Belum ada paket aktif yang tersedia.</section>;
  const recommendedPlan = plans.find((plan) => plan.monthlyPrice > currentPlan.monthlyPrice && plan.maxEmployees > currentPlan.maxEmployees) ?? null;
  const activeOrder = orders.find((order) => order.status === "active" && order.planCode === currentPlan.code);

  return <div className="subscription-reference-page">
    <header className="subscription-reference-header"><small>TepatWaktu Admin Panel</small><h1>LANGGANAN</h1><nav><span>Beranda</span><b>/</b><strong>Langganan</strong></nav></header>
    <SubscriptionManager
      companyName={context.companyName}
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
