import type { Metadata } from "next";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { subscriptionPlans } from "@/db/schema";
import { requireCompany } from "@/lib/current-company";
import { PlanSelector } from "./plan-selector";

export const metadata: Metadata = { title: "Daftar Paket" };

export default async function Page({ searchParams }: { searchParams: Promise<{ plan?: string }> }) {
  const context = await requireCompany();
  const { plan } = await searchParams;
  const plans = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.active, true)).orderBy(asc(subscriptionPlans.monthlyPrice), asc(subscriptionPlans.maxEmployees));
  return <div className="subscription-reference-page">
    <header className="subscription-reference-header"><small>TepatWaktu Admin Panel</small><h1>DAFTAR PAKET</h1><nav><span>Beranda</span><b>/</b><span>Langganan</span><b>/</b><strong>Daftar Paket</strong></nav></header>
    <PlanSelector plans={plans} currentPlanCode={context.plan} canManage={context.role === "admin" || context.role === "owner"} initialPlanId={plan} />
  </div>;
}
