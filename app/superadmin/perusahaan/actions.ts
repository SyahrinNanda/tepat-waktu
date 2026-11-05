"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { companies, subscriptionOrders, subscriptionPlans } from "@/db/schema";
import { periodEnd } from "@/features/subscriptions/plan-rules";
import { recordAudit } from "@/lib/audit";
import { requireSuperAdmin } from "@/lib/superadmin";

export async function setCompanyPlan(form: FormData) {
  const session = await requireSuperAdmin();
  const data = z.object({ companyId: z.uuid(), planId: z.uuid(), grantMonths: z.coerce.number().int().refine((value) => [0, 1, 3, 6, 12].includes(value)).default(0) }).parse(Object.fromEntries(form));
  const [plan] = await db.select({ id: subscriptionPlans.id, code: subscriptionPlans.code, name: subscriptionPlans.name }).from(subscriptionPlans).where(eq(subscriptionPlans.id, data.planId)).limit(1);
  if (!plan) throw new Error("Paket tidak ditemukan.");
  const now = new Date();
  const updated = await db.transaction(async (tx) => {
    const rows = await tx.update(companies).set({ plan: plan.code, updatedAt: now }).where(eq(companies.id, data.companyId)).returning({ id: companies.id });
    if (rows.length) await recordAudit(session, { action: "company.plan_set", companyId: data.companyId, summary: data.grantMonths ? `Paket diubah ke ${plan.name} dan diaktifkan gratis ${data.grantMonths} bulan` : `Paket diubah ke ${plan.name}`, metadata: { planCode: plan.code, grantMonths: data.grantMonths } }, tx);
    if (!rows.length || !data.grantMonths) return rows;
    // A manual grant replaces the running subscription and reopens access for the chosen period.
    await tx.update(subscriptionOrders).set({ status: "cancelled", cancelledAt: now }).where(and(eq(subscriptionOrders.companyId, data.companyId), eq(subscriptionOrders.status, "active")));
    await tx.insert(subscriptionOrders).values({
      companyId: data.companyId, planId: plan.id, invoiceNumber: `MAN-${now.toISOString().slice(0, 10).replaceAll("-", "")}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
      transactionType: "manual", durationMonths: data.grantMonths, subtotal: 0, amount: 0, status: "active", startedAt: now,
      endsAt: periodEnd(now, { durationMonths: data.grantMonths, durationDays: 0 }), requestedBy: session.user.id, verifiedBy: session.user.id, verifiedAt: now,
    });
    return rows;
  });
  if (!updated.length) throw new Error("Perusahaan tidak ditemukan.");
  revalidatePath("/superadmin/langganan");
  revalidatePath("/dashboard/langganan");
  revalidatePath(`/superadmin/perusahaan/${data.companyId}`);
  revalidatePath("/superadmin/perusahaan");
  revalidatePath("/superadmin");
  revalidatePath("/dashboard");
}
