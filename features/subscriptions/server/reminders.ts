import { and, eq, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { subscriptionReminders } from "@/db/schema";
import { escapeHtml, mailConfigured, sendMail } from "@/lib/mailer";
import { formatRupiah } from "../plan-rules";
import { isTrial, loadCompanySubscriptions, reminderRecipients, type CompanySubscription } from "./company-subscriptions";

const MAX_ATTEMPTS = 3;

export type ReminderRunResult = { checked: number; sent: number; failed: number; skipped: number; mailConfigured: boolean; messages: string[] };

function appUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || process.env.BETTER_AUTH_URL || "http://localhost:3000").replace(/\/$/, "");
}

const longDate = (value: Date) => new Intl.DateTimeFormat("id-ID", { dateStyle: "full", timeStyle: "short", timeZone: "Asia/Makassar" }).format(value);

export function reminderEmail(company: CompanySubscription, level: 5 | 2) {
  const order = company.order!;
  const daysLeft = company.status.daysLeft ?? level;
  const trial = isTrial(company);
  const plan = trial ? "masa Free Trial" : `Paket ${order.planName}`;
  const when = daysLeft <= 1 ? "kurang dari 1 hari lagi" : `${daysLeft} hari lagi`;
  const url = `${appUrl()}/dashboard/langganan`;
  const subject = level === 2
    ? `[Segera] ${plan} ${company.name} berakhir ${when}`
    : `Pengingat: ${plan} ${company.name} berakhir ${when}`;
  const next = trial
    ? "Pilih paket berbayar agar seluruh karyawan tetap bisa check-in dan data tetap bisa diakses."
    : `Perpanjang sekarang (mulai ${formatRupiah(order.monthlyPrice)}/bulan) agar seluruh karyawan tetap bisa check-in dan data tetap bisa diakses.`;
  const ends = order.endsAt ? longDate(order.endsAt) : "-";
  const text = [
    `Halo Admin ${company.name},`,
    "",
    `${plan} perusahaan Anda akan berakhir ${when}, pada ${ends}.`,
    "Setelah masa aktif berakhir, seluruh akun karyawan tidak bisa mengakses TepatWaktu sampai paket diperpanjang. Data tetap tersimpan.",
    "",
    next,
    `Buka: ${url}`,
    "",
    "Salam,",
    "Tim TepatWaktu",
  ].join("\n");
  const accent = level === 2 ? "#d93a2b" : "#faa30e";
  const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#faf8f5;font-family:'Plus Jakarta Sans',Arial,sans-serif;color:#1f1d1b">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #ece7df">
<tr><td style="padding:20px 28px;background:#faa30e;font-size:20px;font-weight:800;color:#1f1d1b">Tepat<span style="color:#ffffff">Waktu</span></td></tr>
<tr><td style="padding:28px">
<p style="margin:0 0 6px;font-size:12px;font-weight:800;letter-spacing:.08em;color:${accent};text-transform:uppercase">${level === 2 ? "Segera berakhir" : "Pengingat masa aktif"}</p>
<h1 style="margin:0 0 16px;font-size:22px;line-height:1.3">${escapeHtml(plan)} berakhir ${escapeHtml(when)}</h1>
<p style="margin:0 0 12px;line-height:1.6">Halo Admin <strong>${escapeHtml(company.name)}</strong>,</p>
<p style="margin:0 0 12px;line-height:1.6">Masa aktif akan berakhir pada <strong>${escapeHtml(ends)}</strong>. Setelah itu seluruh akun karyawan tidak bisa mengakses TepatWaktu sampai paket diperpanjang. Data Anda tetap tersimpan.</p>
<p style="margin:0 0 24px;line-height:1.6">${escapeHtml(next)}</p>
<a href="${url}" style="display:inline-block;padding:13px 22px;background:#faa30e;color:#3a2200;font-weight:800;text-decoration:none;border-radius:999px">${trial ? "Pilih Paket" : "Perpanjang Sekarang"}</a>
<p style="margin:24px 0 0;font-size:12px;color:#7a746c;line-height:1.6">Email ini dikirim otomatis ke admin perusahaan pada H-5 dan H-2 sebelum masa aktif berakhir.</p>
</td></tr></table></body></html>`;
  return { subject, html, text };
}

/**
 * Sends the H-5 and H-2 emails that are due. Safe to run as often as you like: each
 * (order, level) is claimed once, and failed sends are retried up to MAX_ATTEMPTS times.
 */
export async function runSubscriptionReminders(now = new Date()): Promise<ReminderRunResult> {
  const result: ReminderRunResult = { checked: 0, sent: 0, failed: 0, skipped: 0, mailConfigured: mailConfigured(), messages: [] };
  if (!result.mailConfigured) {
    result.messages.push("Layanan email belum dikonfigurasi (MAIL_PROVIDERS), email tidak dikirim.");
    return result;
  }
  const companies = (await loadCompanySubscriptions(now)).filter((company) => company.order && company.status.warning);
  for (const company of companies) {
    result.checked += 1;
    const level = company.status.warning!;
    const recipients = reminderRecipients(company);
    if (!recipients.length) { result.skipped += 1; result.messages.push(`${company.name}: tidak ada akun admin dengan email.`); continue; }

    // Claim the (order, level) slot; a failed earlier attempt may be re-claimed.
    const [claim] = await db.insert(subscriptionReminders)
      .values({ orderId: company.order!.id, companyId: company.id, level, recipients: recipients.join(", ") })
      .onConflictDoUpdate({
        target: [subscriptionReminders.orderId, subscriptionReminders.level],
        set: { status: "sending", attempts: sql`${subscriptionReminders.attempts} + 1`, recipients: recipients.join(", "), updatedAt: now },
        setWhere: and(eq(subscriptionReminders.status, "failed"), lt(subscriptionReminders.attempts, MAX_ATTEMPTS)),
      })
      .returning({ id: subscriptionReminders.id });
    if (!claim) { result.skipped += 1; continue; }

    try {
      const delivery = await sendMail({ to: recipients, ...reminderEmail(company, level) });
      await db.update(subscriptionReminders).set({ status: "sent", provider: delivery.provider, sentAt: new Date(), error: null, updatedAt: new Date() }).where(eq(subscriptionReminders.id, claim.id));
      result.sent += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await db.update(subscriptionReminders).set({ status: "failed", error: message.slice(0, 500), updatedAt: new Date() }).where(eq(subscriptionReminders.id, claim.id));
      result.failed += 1;
      result.messages.push(`${company.name}: ${message}`);
    }
  }
  // A process killed mid-send leaves "sending" rows; release them after an hour so they retry.
  await db.update(subscriptionReminders).set({ status: "failed", error: "Pengiriman terputus." })
    .where(and(eq(subscriptionReminders.status, "sending"), lt(subscriptionReminders.updatedAt, new Date(now.getTime() - 3_600_000))));
  return result;
}
