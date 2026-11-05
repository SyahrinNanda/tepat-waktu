"use server";

import { and, eq, inArray, TransactionRollbackError } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { customPlanRequests, subscriptionOrders, subscriptionPlans } from "@/db/schema";
import { requireCompanyRole } from "@/lib/current-company";
import { requireSuperAdmin } from "@/lib/superadmin";
import { recordAudit } from "@/lib/audit";
import { CUSTOM_MIN_EMPLOYEES, CUSTOM_PRICE_FLOOR, DURATION_OPTIONS } from "../plan-rules";

export type CustomPlanState = { status: "idle" | "success" | "error"; message: string };

const employeeCount = z.coerce.number().int().min(CUSTOM_MIN_EMPLOYEES, `Paket Custom untuk lebih dari ${CUSTOM_MIN_EMPLOYEES - 1} karyawan.`).max(1_000_000, "Jumlah karyawan terlalu besar.");
const pricePerEmployee = z.coerce.number().int().min(CUSTOM_PRICE_FLOOR, `Harga per karyawan minimal Rp ${CUSTOM_PRICE_FLOOR.toLocaleString("id-ID")}.`).max(1_000_000, "Harga per karyawan tidak wajar.");
const duration = z.coerce.number().int().refine((value) => (DURATION_OPTIONS as readonly number[]).includes(value), "Durasi tidak valid.");

function refresh() {
  revalidatePath("/dashboard/langganan");
  revalidatePath("/dashboard/langganan/paket");
  revalidatePath("/superadmin/paket");
  revalidatePath("/superadmin/langganan");
}

/** Company admin asks for a negotiated plan above the Enterprise tier. */
export async function submitCustomPlanRequest(_previous: CustomPlanState, formData: FormData): Promise<CustomPlanState> {
  const context = await requireCompanyRole(["admin"], { allowExpired: true });
  const parsed = z.object({
    employeeCount,
    proposedPricePerEmployee: pricePerEmployee,
    durationMonths: duration,
    note: z.string().trim().max(1000).optional(),
  }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Data pengajuan tidak valid." };

  const [open] = await db.select({ id: customPlanRequests.id }).from(customPlanRequests)
    .where(and(eq(customPlanRequests.companyId, context.companyId), eq(customPlanRequests.status, "pending"))).limit(1);
  if (open) return { status: "error", message: "Masih ada pengajuan Paket Custom yang menunggu tinjauan." };

  await db.insert(customPlanRequests).values({
    companyId: context.companyId,
    requestedBy: context.session.user.id,
    employeeCount: parsed.data.employeeCount,
    proposedPricePerEmployee: parsed.data.proposedPricePerEmployee,
    durationMonths: parsed.data.durationMonths,
    note: parsed.data.note || null,
  });
  refresh();
  return { status: "success", message: "Pengajuan Paket Custom terkirim. Tim TepatWaktu akan menghubungi Anda untuk negosiasi." };
}

export async function cancelCustomPlanRequest(formData: FormData) {
  const context = await requireCompanyRole(["admin"], { allowExpired: true });
  const id = z.uuid().parse(formData.get("id"));
  await db.update(customPlanRequests).set({ status: "cancelled" })
    .where(and(eq(customPlanRequests.id, id), eq(customPlanRequests.companyId, context.companyId), eq(customPlanRequests.status, "pending")));
  refresh();
}

/**
 * Superadmin closes the negotiation. Approving creates a plan private to that company and a
 * pending invoice, which then goes through the normal payment + verification flow.
 */
export async function reviewCustomPlanRequest(_previous: CustomPlanState, formData: FormData): Promise<CustomPlanState> {
  const session = await requireSuperAdmin();
  const base = z.object({ id: z.uuid(), decision: z.enum(["approved", "rejected"]), reviewNote: z.string().trim().max(1000).optional() }).safeParse(Object.fromEntries(formData));
  if (!base.success) return { status: "error", message: "Data tinjauan tidak valid." };
  const { id, decision, reviewNote } = base.data;

  const [request] = await db.select().from(customPlanRequests).where(and(eq(customPlanRequests.id, id), eq(customPlanRequests.status, "pending"))).limit(1);
  if (!request) return { status: "error", message: "Pengajuan tidak ditemukan atau sudah ditinjau." };
  const now = new Date();

  if (decision === "rejected") {
    if (!reviewNote) return { status: "error", message: "Tuliskan alasan penolakan atau penawaran balik untuk perusahaan." };
    await db.update(customPlanRequests).set({ status: "rejected", reviewNote: reviewNote || null, reviewedBy: session.user.id, reviewedAt: now })
      .where(and(eq(customPlanRequests.id, id), eq(customPlanRequests.status, "pending")));
    await recordAudit(session, { action: "custom_plan.reject", companyId: request.companyId, summary: `Menolak Paket Custom ${request.employeeCount.toLocaleString("id-ID")} karyawan: ${reviewNote}`, metadata: { requestId: id } });
    refresh();
    return { status: "success", message: "Pengajuan ditolak." };
  }

  const terms = z.object({ agreedEmployeeCount: employeeCount, agreedPricePerEmployee: pricePerEmployee, durationMonths: duration }).safeParse(Object.fromEntries(formData));
  if (!terms.success) return { status: "error", message: terms.error.issues[0]?.message ?? "Kesepakatan tidak valid." };
  const { agreedEmployeeCount, agreedPricePerEmployee, durationMonths } = terms.data;
  const monthlyPrice = agreedEmployeeCount * agreedPricePerEmployee;

  const done = await db.transaction(async (tx) => {
    const [plan] = await tx.insert(subscriptionPlans).values({
      code: `custom-${crypto.randomUUID().slice(0, 8)}`,
      name: `Custom ${agreedEmployeeCount.toLocaleString("id-ID")}`,
      monthlyPrice,
      maxEmployees: agreedEmployeeCount,
      description: `Paket Custom hasil negosiasi: Rp ${agreedPricePerEmployee.toLocaleString("id-ID")} per karyawan per bulan`,
      companyId: request.companyId,
    }).returning({ id: subscriptionPlans.id });
    // Older custom plans of this company are superseded by the new agreement.
    const previous = await tx.select({ id: subscriptionPlans.id }).from(subscriptionPlans).where(eq(subscriptionPlans.companyId, request.companyId));
    const stale = previous.map((row) => row.id).filter((planId) => planId !== plan.id);
    if (stale.length) await tx.update(subscriptionPlans).set({ active: false }).where(inArray(subscriptionPlans.id, stale));

    const subtotal = monthlyPrice * durationMonths;
    const [order] = await tx.insert(subscriptionOrders).values({
      companyId: request.companyId,
      planId: plan.id,
      invoiceNumber: `CST-${now.toISOString().slice(0, 10).replaceAll("-", "")}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
      transactionType: "custom",
      durationMonths,
      subtotal,
      amount: subtotal,
      status: "pending",
      requestedBy: request.requestedBy,
    }).returning({ id: subscriptionOrders.id });

    const updated = await tx.update(customPlanRequests).set({
      status: "approved", agreedEmployeeCount, agreedPricePerEmployee, durationMonths, reviewNote: reviewNote || null,
      planId: plan.id, orderId: order.id, reviewedBy: session.user.id, reviewedAt: now,
    }).where(and(eq(customPlanRequests.id, id), eq(customPlanRequests.status, "pending"))).returning({ id: customPlanRequests.id });
    if (!updated.length) tx.rollback();
    await recordAudit(session, {
      action: "custom_plan.approve", companyId: request.companyId,
      summary: `Menyetujui Paket Custom ${agreedEmployeeCount.toLocaleString("id-ID")} karyawan × Rp ${agreedPricePerEmployee.toLocaleString("id-ID")} selama ${durationMonths} bulan`,
      metadata: { requestId: id, planId: plan.id, orderId: order.id, monthlyPrice },
    }, tx);
    return true;
  }).catch((error) => {
    if (error instanceof TransactionRollbackError) return false;
    throw error;
  });

  if (!done) return { status: "error", message: "Pengajuan sudah ditinjau oleh admin lain." };
  refresh();
  return { status: "success", message: "Paket Custom disetujui. Invoice dikirim ke perusahaan untuk dibayar." };
}
