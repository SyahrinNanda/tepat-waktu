import type { Route } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { CheckCircle2, Clock3, XCircle } from "lucide-react";
import { db } from "@/db";
import { subscriptionOrders, subscriptionPlans } from "@/db/schema";
import { requireCompanyRole } from "@/lib/current-company";
import { resolveTimeZone } from "@/lib/timezone";
import { syncInvoicePayment } from "@/features/subscriptions/server/midtrans-payments";
import { CheckPaymentStatus } from "@/features/subscriptions/components/check-payment-status";
import { RefreshLayoutOnce } from "@/features/subscriptions/components/refresh-layout-once";
import { formatRupiah, PAYMENT_LABELS } from "@/features/subscriptions/plan-rules";

/**
 * Landing page after Midtrans Snap (finish/error). The status shown is re-read from Midtrans, so it
 * is correct even when the webhook has not arrived yet.
 */
export async function PaymentResultPage({ invoiceId, failed, justActivated }: { invoiceId?: string; failed?: boolean; justActivated?: boolean }) {
  const context = await requireCompanyRole(["admin"], { allowExpired: true });
  const id = invoiceId && /^[0-9a-f-]{36}$/i.test(invoiceId) ? invoiceId : null;
  // The dashboard layout (expired-plan banner, menu lock) rendered before this sync ran, so after a fresh
  // activation reload once to show it with the active plan. On the reload the invoice is no longer pending.
  // A full page load gets a fresh layout from the redirect itself; a client refresh (Cek status / auto
  // check) keeps the old layout, which RefreshLayoutOnce fixes via the `aktif=1` marker.
  if (id && await syncInvoicePayment(id, context.companyId) === "activated") {
    redirect(`/dashboard/langganan/pembayaran/${failed ? "gagal" : "berhasil"}?invoice=${id}&aktif=1` as Route);
  }
  const [order] = id ? await db.select({
    id: subscriptionOrders.id, invoiceNumber: subscriptionOrders.invoiceNumber, status: subscriptionOrders.status, amount: subscriptionOrders.amount,
    endsAt: subscriptionOrders.endsAt, gatewayStatus: subscriptionOrders.gatewayStatus, paymentMethod: subscriptionOrders.paymentMethod, planName: subscriptionPlans.name,
  }).from(subscriptionOrders).innerJoin(subscriptionPlans, eq(subscriptionOrders.planId, subscriptionPlans.id))
    .where(and(eq(subscriptionOrders.id, id), eq(subscriptionOrders.companyId, context.companyId))).limit(1) : [];

  const paid = order?.status === "active";
  const waiting = order?.status === "pending" && (order.gatewayStatus === "pending" || (!failed && !order.gatewayStatus));
  const day = (value: Date) => new Intl.DateTimeFormat("id-ID", { dateStyle: "long", timeZone: resolveTimeZone(context.timezone) }).format(value);
  const tone = paid ? "paid" : waiting ? "waiting" : "failed";
  const Icon = paid ? CheckCircle2 : waiting ? Clock3 : XCircle;

  return <section className={`module-card payment-result ${tone}`}>
    {paid && justActivated && <RefreshLayoutOnce />}
    <span className="payment-result-icon"><Icon size={34} /></span>
    {!order ? <><h1>Invoice tidak ditemukan</h1><p>Buka menu Langganan untuk melihat semua invoice Anda.</p></>
      : paid ? <><h1>Pembayaran berhasil</h1><p>Paket {order.planName} sudah aktif{order.endsAt ? ` sampai ${day(order.endsAt)}` : ""}. Terima kasih!</p></>
      : waiting ? <><h1>Menunggu pembayaran</h1><p>Selesaikan pembayaran sesuai instruksi Midtrans (nomor Virtual Account, kode bayar, atau QR). Paket aktif otomatis setelah pembayaran diterima; halaman ini bisa dimuat ulang untuk mengecek status.</p></>
      : <><h1>Pembayaran belum berhasil</h1><p>Transaksi dibatalkan, kedaluwarsa, atau ditolak. Invoice masih bisa dibayar lagi, dengan metode yang sama atau berbeda.</p></>}
    {order && <dl className="payment-result-meta"><div><dt>Invoice</dt><dd>{order.invoiceNumber}</dd></div><div><dt>Total</dt><dd>{formatRupiah(order.amount)}</dd></div>{order.paymentMethod && <div><dt>Metode</dt><dd>{PAYMENT_LABELS[order.paymentMethod]?.split(" (")[0] ?? order.paymentMethod}</dd></div>}</dl>}
    <div className="payment-result-actions">
      {order && !paid && <Link className="btn btn-primary" href={`/dashboard/langganan?invoice=${order.id}`}>{waiting ? "Lihat invoice" : "Bayar lagi"}</Link>}
      {waiting && order && <CheckPaymentStatus />}
      <Link className={`btn ${paid ? "btn-primary" : "btn-outline"}`} href="/dashboard/langganan">Kembali ke Langganan</Link>
    </div>
  </section>;
}
