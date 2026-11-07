import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { companies, paymentGatewayEvents, platformAuditLogs, subscriptionOrders, subscriptionPlans } from "@/db/schema";
import { createSnapTransaction, getTransactionStatus, MIDTRANS_CHANNELS, midtransConfig, paymentOutcome, type MidtransStatus, type PaymentMethod } from "@/lib/midtrans";
import { paymentAdminFee } from "@/features/subscriptions/plan-rules";
import { activatePendingOrder } from "./activate-order";
import { sendPaidInvoiceEmail } from "./invoice-email";

/** A Snap token is valid for 24 hours; reuse it a little shorter than that. */
const TOKEN_REUSE_MS = 23 * 60 * 60 * 1000;

function appUrl(path: string) {
  return `${(process.env.BETTER_AUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/+$/, "")}${path}`;
}

export class PaymentError extends Error {}

/** Midtrans order_id for one payment attempt: the invoice number plus a short unique suffix. */
function attemptOrderId(invoiceNumber: string) {
  return `${invoiceNumber}-P${Date.now().toString(36).toUpperCase()}`.slice(0, 50);
}

/** Invoice number behind a Midtrans order_id (also accepts the bare invoice number). */
export function invoiceNumberFromGatewayOrderId(orderId: string) {
  return orderId.replace(/-P[0-9A-Z]+$/, "");
}

/** Our method name for a Midtrans payment_type (and store, for cstore). */
function methodFromPaymentType(status: MidtransStatus & { store?: string }) {
  switch (status.payment_type) {
    case "bank_transfer": case "echannel": case "permata": return "bank_transfer";
    case "cstore": return status.store === "alfamart" ? "alfamart" : "indomaret";
    case "qris": return "qris";
    case "gopay": return "gopay";
    case "shopeepay": return "shopeepay";
    case "credit_card": return "credit_card";
    case "akulaku": return "akulaku";
    default: return status.payment_type ?? null;
  }
}

/**
 * Creates (or reuses) a Snap transaction for a pending invoice. The admin fee of the chosen method
 * is added to the invoice, and Snap only shows that method, so the amount paid always matches.
 */
export async function startMidtransPayment(input: { orderId: string; companyId: string; method: PaymentMethod; customer: { name: string; email: string } }) {
  if (!midtransConfig().configured) throw new PaymentError("Pembayaran online belum diaktifkan. Hubungi tim TepatWaktu untuk pembayaran manual.");
  const [order] = await db.select({
    id: subscriptionOrders.id, invoiceNumber: subscriptionOrders.invoiceNumber, status: subscriptionOrders.status, subtotal: subscriptionOrders.subtotal,
    discountAmount: subscriptionOrders.discountAmount, paymentMethod: subscriptionOrders.paymentMethod, snapToken: subscriptionOrders.snapToken,
    snapRedirectUrl: subscriptionOrders.snapRedirectUrl, gatewayOrderId: subscriptionOrders.gatewayOrderId, gatewayStatus: subscriptionOrders.gatewayStatus,
    paymentRequestedAt: subscriptionOrders.paymentRequestedAt, planName: subscriptionPlans.name, durationMonths: subscriptionOrders.durationMonths,
    companyPhone: companies.phone,
  }).from(subscriptionOrders).innerJoin(subscriptionPlans, eq(subscriptionOrders.planId, subscriptionPlans.id)).innerJoin(companies, eq(companies.id, subscriptionOrders.companyId))
    .where(and(eq(subscriptionOrders.id, input.orderId), eq(subscriptionOrders.companyId, input.companyId))).limit(1);
  if (!order || order.status !== "pending") throw new PaymentError("Invoice tidak ditemukan atau sudah diproses.");

  // A previous attempt may have been paid in the meantime (e.g. a VA paid after the popup closed).
  if (order.gatewayOrderId) {
    const result = await syncGatewayOrder(order.gatewayOrderId).catch(() => null);
    if (result === "activated" || result === "already_active") return { alreadyPaid: true as const };
  }

  const reusable = order.snapToken && order.paymentMethod === input.method && order.paymentRequestedAt
    && Date.now() - order.paymentRequestedAt.getTime() < TOKEN_REUSE_MS && !["expire", "cancel", "deny", "failure"].includes(order.gatewayStatus ?? "");
  if (reusable) return { token: order.snapToken!, redirectUrl: order.snapRedirectUrl };

  const packagePrice = order.subtotal - order.discountAmount;
  const adminFee = paymentAdminFee(input.method, packagePrice);
  const amount = packagePrice + adminFee;
  const gatewayOrderId = attemptOrderId(order.invoiceNumber);
  const items = [
    { id: "paket", name: `Paket ${order.planName} ${order.durationMonths} bulan`, price: order.subtotal, quantity: 1 },
    ...(order.discountAmount > 0 ? [{ id: "diskon", name: "Diskon kupon", price: -order.discountAmount, quantity: 1 }] : []),
    ...(adminFee > 0 ? [{ id: "biaya-admin", name: "Biaya admin pembayaran", price: adminFee, quantity: 1 }] : []),
  ];
  const snap = await createSnapTransaction({
    orderId: gatewayOrderId, grossAmount: amount, items, enabledPayments: MIDTRANS_CHANNELS[input.method],
    customer: { firstName: input.customer.name, email: input.customer.email, phone: order.companyPhone },
    finishUrl: appUrl(`/dashboard/langganan/pembayaran/berhasil?invoice=${order.id}`),
  });
  await db.update(subscriptionOrders).set({
    paymentMethod: input.method, adminFee, amount, paymentRequestedAt: new Date(),
    gatewayOrderId, snapToken: snap.token, snapRedirectUrl: snap.redirectUrl, gatewayStatus: null, gatewayPaymentType: null,
  }).where(and(eq(subscriptionOrders.id, order.id), eq(subscriptionOrders.status, "pending")));
  return { token: snap.token, redirectUrl: snap.redirectUrl };
}

export type ApplyResult = "activated" | "already_active" | "recorded" | "amount_mismatch" | "unknown_order" | "ignored";

/**
 * Applies an authoritative Midtrans status (from the status API) to its invoice. Any attempt of
 * the invoice counts, so a VA paid from an older attempt still activates it.
 */
export async function applyMidtransStatus(status: MidtransStatus & { store?: string }): Promise<{ result: ApplyResult; orderId: string | null }> {
  const invoiceNumber = invoiceNumberFromGatewayOrderId(status.order_id);
  const [order] = await db.select({
    id: subscriptionOrders.id, companyId: subscriptionOrders.companyId, status: subscriptionOrders.status, invoiceNumber: subscriptionOrders.invoiceNumber,
    subtotal: subscriptionOrders.subtotal, discountAmount: subscriptionOrders.discountAmount, gatewayOrderId: subscriptionOrders.gatewayOrderId,
    planCode: subscriptionPlans.code, planName: subscriptionPlans.name, durationMonths: subscriptionOrders.durationMonths, durationDays: subscriptionOrders.durationDays,
    companyName: companies.name,
  }).from(subscriptionOrders).innerJoin(subscriptionPlans, eq(subscriptionOrders.planId, subscriptionPlans.id)).innerJoin(companies, eq(companies.id, subscriptionOrders.companyId))
    .where(eq(subscriptionOrders.invoiceNumber, invoiceNumber)).limit(1);
  if (!order) return { result: "unknown_order", orderId: null };

  const outcome = paymentOutcome(status);
  if (outcome !== "paid") {
    // Only the latest attempt drives the status shown on the invoice.
    if (order.status === "pending" && order.gatewayOrderId === status.order_id && status.transaction_status) {
      await db.update(subscriptionOrders).set({ gatewayStatus: status.transaction_status, gatewayPaymentType: status.payment_type ?? null })
        .where(and(eq(subscriptionOrders.id, order.id), eq(subscriptionOrders.status, "pending")));
      return { result: "recorded", orderId: order.id };
    }
    return { result: "ignored", orderId: order.id };
  }
  if (order.status === "active") return { result: "already_active", orderId: order.id };
  if (order.status !== "pending") return { result: "ignored", orderId: order.id };

  const paid = Math.round(Number(status.gross_amount));
  const packagePrice = order.subtotal - order.discountAmount;
  // The package price must be covered; the rest is the admin fee of the method actually used.
  if (!Number.isFinite(paid) || paid < packagePrice) return { result: "amount_mismatch", orderId: order.id };

  const now = new Date();
  const activated = await db.transaction(async (tx) => {
    await tx.update(subscriptionOrders).set({ amount: paid, adminFee: paid - packagePrice, paymentMethod: methodFromPaymentType(status), gatewayOrderId: status.order_id })
      .where(and(eq(subscriptionOrders.id, order.id), eq(subscriptionOrders.status, "pending")));
    const done = await activatePendingOrder(tx, order, { verifiedBy: null, now, paid: { at: now, paymentType: status.payment_type ?? null, gatewayStatus: status.transaction_status ?? null } });
    if (done) {
      await tx.insert(platformAuditLogs).values({
        actorUserId: null, actorName: "Midtrans", actorEmail: "sistem", action: "payment.gateway", companyId: order.companyId, companyName: order.companyName,
        summary: `Pembayaran ${order.invoiceNumber} diterima lewat Midtrans (Paket ${order.planName}, Rp ${paid.toLocaleString("id-ID")})`,
        metadata: { orderId: order.id, invoiceNumber: order.invoiceNumber, gatewayOrderId: status.order_id, paymentType: status.payment_type, transactionId: status.transaction_id, amount: paid },
      });
    }
    return done;
  });
  if (activated) sendPaidInvoiceEmail(order.id);
  return { result: activated ? "activated" : "already_active", orderId: order.id };
}

/** Pulls the status of one Midtrans order from the status API and applies it. */
export async function syncGatewayOrder(gatewayOrderId: string): Promise<ApplyResult> {
  const status = await getTransactionStatus(gatewayOrderId);
  if (!status) return "ignored";
  return (await applyMidtransStatus(status)).result;
}

/** Re-checks a company's invoice with Midtrans (after the popup closes / on the finish page). */
export async function syncInvoicePayment(orderId: string, companyId: string) {
  if (!midtransConfig().configured) return null;
  const [order] = await db.select({ gatewayOrderId: subscriptionOrders.gatewayOrderId, status: subscriptionOrders.status })
    .from(subscriptionOrders).where(and(eq(subscriptionOrders.id, orderId), eq(subscriptionOrders.companyId, companyId))).limit(1);
  if (!order?.gatewayOrderId || order.status !== "pending") return null;
  return syncGatewayOrder(order.gatewayOrderId).catch((error) => { console.error("Midtrans sync gagal:", error); return null; });
}

export async function logGatewayEvent(entry: { orderId: string | null; payload: Record<string, unknown>; signatureValid: boolean; result: string }) {
  const value = (key: string) => typeof entry.payload[key] === "string" ? entry.payload[key] as string : null;
  await db.insert(paymentGatewayEvents).values({
    orderId: entry.orderId, gatewayOrderId: value("order_id") ?? "(kosong)", transactionStatus: value("transaction_status"), paymentType: value("payment_type"),
    grossAmount: value("gross_amount"), signatureValid: entry.signatureValid, result: entry.result,
    // The signature is a secret-derived hash; it is not needed after verification.
    payload: { ...entry.payload, signature_key: entry.payload.signature_key ? "(disembunyikan)" : undefined },
  });
}
