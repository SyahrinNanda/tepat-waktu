import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { companies, companyMembers, subscriptionOrders, subscriptionPlans, user } from "@/db/schema";
import { escapeHtml, sendMail } from "@/lib/mailer";
import { resolveTimeZone } from "@/lib/timezone";
import { durationLabel, formatRupiah, PAYMENT_LABELS } from "@/features/subscriptions/plan-rules";

function appUrl(path: string) {
  const base = (process.env.BETTER_AUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/+$/, "");
  return `${base}${path}`;
}

type PaidInvoice = {
  invoiceNumber: string; companyName: string; planName: string; durationMonths: number; durationDays: number;
  subtotal: number; discountAmount: number; couponCode: string | null; adminFee: number; amount: number;
  paymentMethod: string | null; paidAt: Date; startedAt: Date | null; endsAt: Date | null; timezone: string;
};

/** "Paid" invoice email (HTML + plain text), styled like the other TepatWaktu emails. */
export function renderPaidInvoiceEmail(invoice: PaidInvoice) {
  const zone = resolveTimeZone(invoice.timezone);
  const day = (value: Date) => new Intl.DateTimeFormat("id-ID", { dateStyle: "long", timeZone: zone }).format(value);
  const dateTime = (value: Date) => new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: zone }).format(value);
  const method = invoice.paymentMethod ? PAYMENT_LABELS[invoice.paymentMethod]?.split(" (")[0] ?? invoice.paymentMethod : null;
  const period = invoice.startedAt && invoice.endsAt ? `${day(invoice.startedAt)} – ${day(invoice.endsAt)}` : null;
  const lines: [string, string][] = [
    [`Paket ${invoice.planName} (${durationLabel(invoice)})`, formatRupiah(invoice.subtotal)],
    [invoice.couponCode ? `Diskon kupon ${invoice.couponCode}` : "Diskon", `− ${formatRupiah(invoice.discountAmount)}`],
    ["Biaya admin", formatRupiah(invoice.adminFee)],
  ];
  const meta: [string, string][] = [
    ["No. invoice", invoice.invoiceNumber], ["Ditagihkan kepada", invoice.companyName], ["Tanggal bayar", dateTime(invoice.paidAt)],
    ...(method ? [["Metode", method] as [string, string]] : []), ...(period ? [["Masa aktif", period] as [string, string]] : []),
  ];
  const url = appUrl("/dashboard/langganan");
  const subject = `Pembayaran berhasil – Invoice ${invoice.invoiceNumber}`;
  const intro = `Terima kasih! Pembayaran langganan ${invoice.companyName} sudah kami terima dan Paket ${invoice.planName} sekarang aktif${invoice.endsAt ? ` sampai ${day(invoice.endsAt)}` : ""}.`;

  const text = [
    "Pembayaran berhasil", "", intro, "",
    ...meta.map(([k, v]) => `${k}: ${v}`), "",
    ...lines.map(([k, v]) => `${k}: ${v}`), `Total dibayar: ${formatRupiah(invoice.amount)}`, "",
    `Lihat invoice: ${url}`, "", "Salam,", "Tim TepatWaktu",
  ].join("\n");

  const row = (k: string, v: string, style = "") => `<tr><td style="padding:6px 0;color:#6b665f;${style}">${escapeHtml(k)}</td><td style="padding:6px 0;text-align:right;color:#1f1d1b;${style}">${escapeHtml(v)}</td></tr>`;
  const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#faf8f5;font-family:'Plus Jakarta Sans',Arial,sans-serif;color:#1f1d1b">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #ece7df">
<tr><td style="padding:20px 28px;background:#faa30e;font-size:20px;font-weight:800;color:#1f1d1b">Tepat<span style="color:#ffffff">Waktu</span></td></tr>
<tr><td style="padding:28px">
<p style="margin:0 0 6px;font-size:12px;font-weight:800;letter-spacing:.08em;color:#0a7a45;text-transform:uppercase">Lunas</p>
<h1 style="margin:0 0 12px;font-size:22px;line-height:1.3">Pembayaran berhasil</h1>
<p style="margin:0 0 22px;line-height:1.6">${escapeHtml(intro)}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;border-bottom:1px dashed #ddd6cb;margin-bottom:14px;padding-bottom:8px">${meta.map(([k, v]) => row(k, v)).join("")}</table>
<p style="margin:0 0 4px;font-size:11px;font-weight:800;letter-spacing:.06em;color:#8a857e;text-transform:uppercase">Ringkasan biaya</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px">${lines.map(([k, v]) => row(k, v)).join("")}
${row("Total dibayar", formatRupiah(invoice.amount), "padding-top:12px;border-top:1px solid #ece7df;font-weight:800;font-size:16px;color:#1f1d1b")}</table>
<a href="${escapeHtml(url)}" style="display:inline-block;margin-top:24px;padding:13px 22px;background:#faa30e;color:#3a2200;font-weight:800;text-decoration:none;border-radius:999px">Lihat Invoice</a>
<p style="margin:20px 0 0;font-size:12px;color:#7a746c;line-height:1.6">Invoice lengkap bisa dicetak dari menu Langganan. Email ini dikirim ke admin perusahaan sebagai bukti pembayaran.</p>
</td></tr></table></body></html>`;
  return { subject, html, text };
}

/**
 * Emails the paid invoice to every admin of the company. Called after an invoice is activated
 * (Midtrans or manual verification). Fire-and-forget: failures are logged, never thrown, so a mail
 * outage can never undo or block an activation.
 */
export function sendPaidInvoiceEmail(orderId: string) {
  void (async () => {
    const [order] = await db.select({
      invoiceNumber: subscriptionOrders.invoiceNumber, companyId: subscriptionOrders.companyId, status: subscriptionOrders.status,
      companyName: companies.name, timezone: companies.timezone, planName: subscriptionPlans.name,
      durationMonths: subscriptionOrders.durationMonths, durationDays: subscriptionOrders.durationDays,
      subtotal: subscriptionOrders.subtotal, discountAmount: subscriptionOrders.discountAmount, couponCode: subscriptionOrders.couponCode,
      adminFee: subscriptionOrders.adminFee, amount: subscriptionOrders.amount, paymentMethod: subscriptionOrders.paymentMethod,
      paidAt: subscriptionOrders.paidAt, verifiedAt: subscriptionOrders.verifiedAt, startedAt: subscriptionOrders.startedAt, endsAt: subscriptionOrders.endsAt,
    }).from(subscriptionOrders)
      .innerJoin(subscriptionPlans, eq(subscriptionOrders.planId, subscriptionPlans.id))
      .innerJoin(companies, eq(companies.id, subscriptionOrders.companyId))
      .where(eq(subscriptionOrders.id, orderId)).limit(1);
    if (!order || order.status !== "active") return;
    const admins = await db.select({ email: user.email }).from(companyMembers).innerJoin(user, eq(user.id, companyMembers.userId))
      .where(and(eq(companyMembers.companyId, order.companyId), eq(companyMembers.role, "admin")));
    const to = [...new Set(admins.map((admin) => admin.email))];
    if (!to.length) return;
    const delivery = await sendMail({ to, ...renderPaidInvoiceEmail({ ...order, paidAt: order.paidAt ?? order.verifiedAt ?? new Date() }) });
    console.info(`Email invoice ${order.invoiceNumber} dikirim ke ${to.join(", ")} lewat ${delivery.label}.`);
  })().catch((error) => console.error(`Email invoice ${orderId} gagal dikirim:`, error instanceof Error ? error.message : error));
}
