import type { Metadata } from "next";
import { and, asc, desc, eq, isNull, or } from "drizzle-orm";
import { db } from "@/db";
import { customPlanRequests, subscriptionPlans } from "@/db/schema";
import { redirect } from "next/navigation";
import { requireCompany, SUBSCRIPTION_LOCKED_PATH } from "@/lib/current-company";
import { CustomPlanCard, CustomPlanHistory } from "@/features/subscriptions/components/custom-plan-card";
import { PlanSelector } from "./plan-selector";

export const metadata: Metadata = { title: "Daftar Paket" };

export default async function Page({ searchParams }: { searchParams: Promise<{ plan?: string }> }) {
  const context = await requireCompany({ allowExpired: true });
  // Only the company admin renews; other members whose access ended go to the locked page.
  if (context.subscription.state === "expired" && !context.isSuperAdmin && context.role !== "admin" && context.role !== "owner") redirect(SUBSCRIPTION_LOCKED_PATH);
  const { plan } = await searchParams;
  const canManage = context.role === "admin" || context.role === "owner";
  const [plans, requests] = await Promise.all([
    // Public tiers plus any custom plan negotiated for this company.
    db.select().from(subscriptionPlans)
      .where(and(eq(subscriptionPlans.active, true), or(isNull(subscriptionPlans.companyId), eq(subscriptionPlans.companyId, context.companyId))))
      .orderBy(asc(subscriptionPlans.monthlyPrice), asc(subscriptionPlans.maxEmployees)),
    db.select().from(customPlanRequests).where(eq(customPlanRequests.companyId, context.companyId)).orderBy(desc(customPlanRequests.createdAt)).limit(10),
  ]);
  const requestRows = requests.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() }));
  return <div className="subscription-reference-page">
    <header className="subscription-reference-header"><small>TepatWaktu Admin Panel</small><h1>DAFTAR PAKET</h1><nav><span>Beranda</span><b>/</b><span>Langganan</span><b>/</b><strong>Daftar Paket</strong></nav></header>
    <PlanSelector plans={plans} currentPlanCode={context.plan} canManage={canManage} initialPlanId={plan}>
      <CustomPlanCard canManage={canManage} requests={requestRows} />
    </PlanSelector>
    <CustomPlanHistory canManage={canManage} requests={requestRows} />
  </div>;
}
