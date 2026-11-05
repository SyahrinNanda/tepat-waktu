"use server";

import { and, desc, eq, gt, isNull, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { companies, subscriptionOrders, subscriptionPlans } from "@/db/schema";
import { requireSuperAdmin } from "@/lib/superadmin";
import { recordAudit } from "@/lib/audit";
import { periodEnd } from "../plan-rules";
import { runSubscriptionReminders, type ReminderRunResult } from "./reminders";

export type ManualExtendState = { status: "idle" | "success" | "error"; message: string };

function refresh() {
  for (const path of ["/superadmin", "/superadmin/retensi", "/superadmin/pendapatan", "/superadmin/konversi", "/superadmin/langganan", "/dashboard/langganan"]) revalidatePath(path);
}

/**
 * Sales/CS extends a company by hand (e.g. paid by bank transfer, or a goodwill extension).
 * Same plan still running → continues from its end date; otherwise starts now and replaces it.
 */
export async function extendSubscriptionManually(_previous: ManualExtendState, formData: FormData): Promise<ManualExtendState> {
  const session = await requireSuperAdmin();
  const parsed = z.object({
    companyId: z.uuid(),
    planId: z.uuid(),
    months: z.coerce.number().int().refine((value) => [1, 3, 6, 12].includes(value), "Durasi tidak valid."),
    amount: z.coerce.number().int().min(0, "Nominal tidak boleh negatif.").max(10_000_000_000).default(0),
  }).safeParse({ ...Object.fromEntries(formData), amount: formData.get("amount") || 0 });
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Data tidak valid." };
  const { companyId, planId, months, amount } = parsed.data;

  const [plan] = await db.select({ id: subscriptionPlans.id, code: subscriptionPlans.code, name: subscriptionPlans.name }).from(subscriptionPlans)
    .where(and(eq(subscriptionPlans.id, planId), or(isNull(subscriptionPlans.companyId), eq(subscriptionPlans.companyId, companyId)))).limit(1);
  if (!plan) return { status: "error", message: "Paket tidak tersedia untuk perusahaan ini." };
  const [company] = await db.select({ id: companies.id, name: companies.name }).from(companies).where(eq(companies.id, companyId)).limit(1);
  if (!company) return { status: "error", message: "Perusahaan tidak ditemukan." };

  const now = new Date();
  const [running] = await db.select({ endsAt: subscriptionOrders.endsAt }).from(subscriptionOrders)
    .where(and(eq(subscriptionOrders.companyId, companyId), eq(subscriptionOrders.status, "active"), eq(subscriptionOrders.planId, plan.id), gt(subscriptionOrders.endsAt, now)))
    .orderBy(desc(subscriptionOrders.endsAt)).limit(1);
  const startsAt = running?.endsAt ?? now;
  const endsAt = periodEnd(startsAt, { durationMonths: months, durationDays: 0 });

  await db.transaction(async (tx) => {
    // A different plan replaces whatever is running.
    if (!running) await tx.update(subscriptionOrders).set({ status: "cancelled", cancelledAt: now }).where(and(eq(subscriptionOrders.companyId, companyId), eq(subscriptionOrders.status, "active")));
    await tx.insert(subscriptionOrders).values({
      companyId, planId: plan.id,
      invoiceNumber: `MAN-${now.toISOString().slice(0, 10).replaceAll("-", "")}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
      transactionType: "manual", durationMonths: months, subtotal: amount, amount, status: "active",
      paymentMethod: amount > 0 ? "manual" : null, paymentRequestedAt: amount > 0 ? now : null,
      startedAt: now, endsAt, requestedBy: session.user.id, verifiedBy: session.user.id, verifiedAt: now,
    });
    await tx.update(companies).set({ plan: plan.code, updatedAt: now }).where(eq(companies.id, companyId));
    await recordAudit(session, {
      action: "subscription.manual_extend", companyId,
      summary: `Perpanjang manual Paket ${plan.name} ${months} bulan sampai ${endsAt.toISOString().slice(0, 10)}${amount ? `, diterima Rp ${amount.toLocaleString("id-ID")}` : " (gratis)"}`,
      metadata: { planId: plan.id, months, amount, endsAt: endsAt.toISOString(), continuedFrom: running?.endsAt?.toISOString() ?? null },
    }, tx);
  });
  refresh();
  const until = new Intl.DateTimeFormat("id-ID", { dateStyle: "long", timeZone: "Asia/Makassar" }).format(endsAt);
  return { status: "success", message: `${company.name} aktif dengan Paket ${plan.name} sampai ${until}.` };
}

export async function runRemindersNow(): Promise<ReminderRunResult> {
  await requireSuperAdmin();
  const result = await runSubscriptionReminders();
  refresh();
  return result;
}
