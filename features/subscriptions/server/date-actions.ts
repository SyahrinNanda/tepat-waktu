"use server";

import { and, eq, isNull, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { companies, subscriptionOrders, subscriptionPlans, subscriptionReminders } from "@/db/schema";
import { requireSuperAdmin } from "@/lib/superadmin";
import { recordAudit } from "@/lib/audit";
import { getSubscriptionStatus } from "./subscription-status";

export type CompanyDatesState = { status: "idle" | "success" | "error"; message: string };

/** Form values are wall-clock times in the platform zone (WITA, UTC+8). */
const WITA = "+08:00";
const dateField = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal tidak valid.");
const dateTimeField = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Format tanggal & jam tidak valid.");
const longDate = (value: Date) => new Intl.DateTimeFormat("id-ID", { dateStyle: "long", timeStyle: "short", timeZone: "Asia/Makassar" }).format(value);

/**
 * Superadmin corrects a company's registration date and/or the due date of its current
 * subscription. A company without a running order gets a free manual order ending on that date.
 */
export async function updateCompanyDates(_previous: CompanyDatesState, formData: FormData): Promise<CompanyDatesState> {
  const session = await requireSuperAdmin();
  const parsed = z.object({
    companyId: z.uuid(),
    registeredAt: dateField,
    dueAt: dateTimeField.optional().or(z.literal("")),
  }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Data tidak valid." };
  const { companyId, registeredAt, dueAt } = parsed.data;

  const now = new Date();
  const registered = new Date(`${registeredAt}T00:00:00${WITA}`);
  if (Number.isNaN(registered.getTime()) || registered > now) return { status: "error", message: "Tanggal terdaftar tidak boleh di masa depan." };
  if (registered.getUTCFullYear() < 2000) return { status: "error", message: "Tanggal terdaftar tidak wajar." };
  const due = dueAt ? new Date(`${dueAt}:00${WITA}`) : null;
  if (due && Number.isNaN(due.getTime())) return { status: "error", message: "Jatuh tempo tidak valid." };
  if (due && due < registered) return { status: "error", message: "Jatuh tempo tidak boleh sebelum tanggal terdaftar." };

  const [company] = await db.select({ id: companies.id, name: companies.name, plan: companies.plan }).from(companies).where(eq(companies.id, companyId)).limit(1);
  if (!company) return { status: "error", message: "Perusahaan tidak ditemukan." };
  const status = due ? await getSubscriptionStatus(companyId) : null;

  await db.transaction(async (tx) => {
    const [before] = await tx.select({ createdAt: companies.createdAt }).from(companies).where(eq(companies.id, companyId)).limit(1);
    await recordAudit(session, {
      action: "company.dates_update", companyId,
      summary: `Tanggal terdaftar ${registeredAt}${due ? `, jatuh tempo ${dueAt?.replace("T", " ")} WITA` : ""}`,
      metadata: { registeredBefore: before?.createdAt.toISOString(), registeredAfter: registered.toISOString(), dueBefore: status?.endsAt ?? null, dueAfter: due?.toISOString() ?? null },
    }, tx);
    await tx.update(companies).set({ createdAt: registered, updatedAt: now }).where(eq(companies.id, companyId));
    if (!due || !status) return;
    if (status.orderId) {
      const [order] = await tx.select({ startedAt: subscriptionOrders.startedAt }).from(subscriptionOrders).where(eq(subscriptionOrders.id, status.orderId)).limit(1);
      await tx.update(subscriptionOrders).set({
        endsAt: due,
        // Keep the period consistent if the new due date is earlier than its start.
        startedAt: order?.startedAt && order.startedAt > due ? due : order?.startedAt,
      }).where(eq(subscriptionOrders.id, status.orderId));
      // The H-5 / H-2 emails are re-evaluated against the new date.
      await tx.delete(subscriptionReminders).where(eq(subscriptionReminders.orderId, status.orderId));
      return;
    }
    // No running order (cancelled, or a legacy company): open one on the company's current plan.
    let [plan] = await tx.select({ id: subscriptionPlans.id }).from(subscriptionPlans)
      .where(and(eq(subscriptionPlans.code, company.plan), or(isNull(subscriptionPlans.companyId), eq(subscriptionPlans.companyId, companyId)))).limit(1);
    if (!plan) [plan] = await tx.select({ id: subscriptionPlans.id }).from(subscriptionPlans).where(and(eq(subscriptionPlans.code, "free"), isNull(subscriptionPlans.companyId))).limit(1);
    if (!plan) throw new Error("Paket perusahaan tidak ditemukan.");
    await tx.insert(subscriptionOrders).values({
      companyId, planId: plan.id,
      invoiceNumber: `MAN-${now.toISOString().slice(0, 10).replaceAll("-", "")}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
      transactionType: "manual", durationMonths: 0, subtotal: 0, amount: 0, status: "active",
      startedAt: now < due ? now : due, endsAt: due, requestedBy: session.user.id, verifiedBy: session.user.id, verifiedAt: now,
    });
  });

  for (const path of [`/superadmin/perusahaan/${companyId}`, "/superadmin/perusahaan", "/superadmin", "/superadmin/retensi", "/superadmin/konversi", "/superadmin/langganan", "/dashboard/langganan"]) revalidatePath(path);
  const parts = [`Tanggal terdaftar: ${new Intl.DateTimeFormat("id-ID", { dateStyle: "long", timeZone: "Asia/Makassar" }).format(registered)}`];
  if (due) parts.push(`jatuh tempo: ${longDate(due)}${due <= now ? " (akses perusahaan sekarang terkunci)" : ""}`);
  return { status: "success", message: `${company.name} diperbarui. ${parts.join(", ")}.` };
}
