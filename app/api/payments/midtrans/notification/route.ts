import { verifyNotificationSignature, midtransConfig, MidtransError } from "@/lib/midtrans";
import { invoiceNumberFromGatewayOrderId, logGatewayEvent, syncGatewayOrder } from "@/features/subscriptions/server/midtrans-payments";
import { db } from "@/db";
import { subscriptionOrders } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export const runtime = "nodejs";

/**
 * Midtrans HTTP notification (set as "Payment Notification URL" in the Midtrans dashboard).
 * The body is only trusted after the signature check, and even then the status is re-read from
 * the Midtrans status API before anything is activated. Midtrans retries on non-2xx responses.
 */
export async function POST(request: Request) {
  const payload = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!payload || typeof payload.order_id !== "string") return Response.json({ message: "Body tidak valid." }, { status: 400 });
  if (!midtransConfig().configured) return Response.json({ message: "Midtrans belum dikonfigurasi." }, { status: 503 });

  const [order] = await db.select({ id: subscriptionOrders.id }).from(subscriptionOrders)
    .where(eq(subscriptionOrders.invoiceNumber, invoiceNumberFromGatewayOrderId(payload.order_id))).limit(1);

  if (!verifyNotificationSignature(payload)) {
    await logGatewayEvent({ orderId: order?.id ?? null, payload, signatureValid: false, result: "rejected_signature" });
    return Response.json({ message: "Signature tidak valid." }, { status: 401 });
  }
  try {
    const result = await syncGatewayOrder(payload.order_id);
    await logGatewayEvent({ orderId: order?.id ?? null, payload, signatureValid: true, result: order ? result : "unknown_order" });
    if (result === "activated") { revalidatePath("/dashboard/langganan"); revalidatePath("/superadmin/langganan"); }
    return Response.json({ ok: true, result });
  } catch (error) {
    // Status API unreachable: answer 5xx so Midtrans sends the notification again later.
    console.error("Midtrans notification error:", error);
    await logGatewayEvent({ orderId: order?.id ?? null, payload, signatureValid: true, result: "status_check_failed" }).catch(() => undefined);
    return Response.json({ message: error instanceof MidtransError ? error.message : "Gagal memproses notifikasi." }, { status: 502 });
  }
}
