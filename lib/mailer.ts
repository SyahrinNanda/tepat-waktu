import nodemailer, { type Transporter } from "nodemailer";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { mailProviderUsage } from "@/db/schema";

/**
 * Outgoing email over SMTP with provider fallback.
 *
 * Several providers (e.g. free tiers of Brevo, Mailjet, Mailtrap) are tried in the order of
 * MAIL_PROVIDERS. Each send starts again at the first one, so once its daily quota resets
 * (00:00 UTC) mail goes back to it automatically. A provider is skipped while:
 * - it already sent its SMTP_<NAME>_DAILY_LIMIT emails today (counted in mail_provider_usage), or
 * - it answered with a quota/rate-limit error (skipped until the next reset), or
 * - it failed for another reason (paused for a few minutes).
 *
 * Configuration per provider NAME (upper case in the variable): SMTP_<NAME>_HOST, _PORT, _SECURE,
 * _USER, _PASS, _DAILY_LIMIT (0 or empty = no limit) and optional _FROM (defaults to MAIL_FROM).
 * Local development uses MAIL_PROVIDERS=mailpit (SMTP_MAILPIT_HOST/PORT), so no real email leaves the machine.
 */

export type MailProvider = {
  name: string; label: string; host: string; port: number; secure: boolean;
  user?: string; pass?: string; from: string; dailyLimit: number;
};
export type MailResult = { provider: string; label: string };
export type MailMessage = { to: string[]; subject: string; html: string; text: string };

const KNOWN_LABELS: Record<string, string> = { brevo: "Brevo", mailjet: "Mailjet", mailtrap: "Mailtrap", resend: "Resend", smtp2go: "SMTP2GO", mailpit: "Mailpit" };
const DEFAULT_FROM = "TepatWaktu <no-reply@tepatwaktu.local>";
/** Pause after a non-quota failure (connection refused, bad login, timeout...). */
const ERROR_PAUSE_MS = 5 * 60_000;

export class MailDeliveryError extends Error {
  constructor(message: string, readonly attempts: string[]) { super(message); this.name = "MailDeliveryError"; }
}

function readProvider(name: string, prefix: string): MailProvider | null {
  const env = (key: string) => process.env[`${prefix}${key}`]?.trim() || undefined;
  const host = env("HOST");
  if (!host) return null;
  return {
    name,
    label: KNOWN_LABELS[name] ?? name.charAt(0).toUpperCase() + name.slice(1),
    host,
    port: Number(env("PORT") || 587),
    secure: env("SECURE") === "true",
    user: env("USER"),
    pass: env("PASS"),
    from: env("FROM") || process.env.MAIL_FROM || DEFAULT_FROM,
    dailyLimit: Math.max(0, Number(env("DAILY_LIMIT") || 0) || 0),
  };
}

/** Configured providers in fallback order. */
export function mailProviders(): MailProvider[] {
  const names = (process.env.MAIL_PROVIDERS || "").split(",").map((value) => value.trim().toLowerCase()).filter(Boolean);
  return [...new Set(names)].map((name) => readProvider(name, `SMTP_${name.toUpperCase().replace(/[^A-Z0-9]/g, "_")}_`)).filter((value): value is MailProvider => value !== null);
}

export function mailConfigured() {
  return mailProviders().length > 0;
}

const transporters = new Map<string, Transporter>();
function transport(provider: MailProvider) {
  const key = `${provider.name}|${provider.host}|${provider.port}|${provider.user ?? ""}`;
  let transporter = transporters.get(key);
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: provider.host,
      port: provider.port,
      secure: provider.secure,
      auth: provider.user ? { user: provider.user, pass: provider.pass ?? "" } : undefined,
      // Short timeouts so a dead provider does not hold up the fallback.
      connectionTimeout: 4_000,
      greetingTimeout: 4_000,
      socketTimeout: 8_000,
    });
    transporters.set(key, transporter);
  }
  return transporter;
}

/** Quota counters reset at 00:00 UTC, like most providers' free plans. */
export const usageDay = (now: Date) => now.toISOString().slice(0, 10);
const nextReset = (now: Date) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));

/** True when the SMTP answer means "you've hit your sending limit", not a temporary glitch. */
export function isQuotaError(error: unknown) {
  const info = error as { responseCode?: number; response?: string; message?: string };
  const text = `${info?.response ?? ""} ${info?.message ?? ""}`;
  if (!info?.responseCode || info.responseCode < 400) return false;
  return /quota|limit|exceed|too many|rate|daily|credits?/i.test(text);
}

/** Permanent (5xx) refusal of the recipient address, as opposed to a provider-side problem. */
export function isRecipientRejected(error: unknown) {
  const info = error as { code?: string; responseCode?: number };
  return info?.code === "EENVELOPE" && (info.responseCode ?? 0) >= 500;
}

async function loadUsage(day: string) {
  try {
    const rows = await db.select().from(mailProviderUsage).where(eq(mailProviderUsage.day, day));
    return new Map(rows.map((row) => [row.provider, row]));
  } catch (error) {
    // Counters are an optimisation: without them we still try providers in order.
    console.error("Pemakaian layanan email tidak bisa dibaca:", error);
    return new Map<string, typeof mailProviderUsage.$inferSelect>();
  }
}

async function recordUsage(provider: string, day: string, outcome: { sent: true } | { sent: false; blockedUntil: Date | null; error: string }) {
  const now = new Date();
  const values = outcome.sent
    ? { provider, day, sent: 1, updatedAt: now }
    : { provider, day, failed: 1, blockedUntil: outcome.blockedUntil, lastError: outcome.error.slice(0, 500), updatedAt: now };
  try {
    await db.insert(mailProviderUsage).values(values).onConflictDoUpdate({
      target: [mailProviderUsage.provider, mailProviderUsage.day],
      set: outcome.sent
        ? { sent: sql`${mailProviderUsage.sent} + 1`, updatedAt: now }
        : { failed: sql`${mailProviderUsage.failed} + 1`, blockedUntil: outcome.blockedUntil, lastError: outcome.error.slice(0, 500), updatedAt: now },
    });
  } catch (error) {
    console.error("Pemakaian layanan email tidak bisa dicatat:", error);
  }
}

/**
 * Sends one email through the first available provider. Throws MailDeliveryError when every
 * provider is exhausted or failing; its message lists what happened with each one.
 */
export async function sendMail(message: MailMessage, now = new Date()): Promise<MailResult> {
  if (!message.to.length) throw new Error("Tidak ada alamat email penerima.");
  const providers = mailProviders();
  if (!providers.length) throw new MailDeliveryError("Layanan email belum dikonfigurasi (isi MAIL_PROVIDERS dan SMTP_<NAMA>_*).", []);

  const day = usageDay(now);
  const usage = await loadUsage(day);
  const attempts: string[] = [];
  for (const provider of providers) {
    const today = usage.get(provider.name);
    if (today?.blockedUntil && today.blockedUntil > now) { attempts.push(`${provider.label}: dilewati sampai ${today.blockedUntil.toISOString()}`); continue; }
    if (provider.dailyLimit && (today?.sent ?? 0) >= provider.dailyLimit) { attempts.push(`${provider.label}: kuota harian ${provider.dailyLimit} habis`); continue; }
    try {
      await transport(provider).sendMail({ from: provider.from, to: message.to.join(", "), subject: message.subject, html: message.html, text: message.text });
      await recordUsage(provider.name, day, { sent: true });
      return { provider: provider.name, label: provider.label };
    } catch (error) {
      const text = error instanceof Error ? error.message : String(error);
      const quota = isQuotaError(error);
      if (!quota && isRecipientRejected(error)) {
        // The address itself was refused (unknown mailbox, blocklisted...). The provider is healthy
        // and another one would refuse it too, so neither pause it nor fall back.
        await recordUsage(provider.name, day, { sent: false, blockedUntil: null, error: text });
        attempts.push(`${provider.label}: alamat penerima ditolak (${text.slice(0, 160)})`);
        throw new MailDeliveryError(`Alamat penerima ditolak oleh ${provider.label}: ${text.slice(0, 200)}`, attempts);
      }
      await recordUsage(provider.name, day, { sent: false, blockedUntil: quota ? nextReset(now) : new Date(now.getTime() + ERROR_PAUSE_MS), error: text });
      attempts.push(`${provider.label}: ${quota ? "kuota habis" : "gagal"} (${text.slice(0, 160)})`);
    }
  }
  throw new MailDeliveryError(`Semua layanan email tidak tersedia. ${attempts.join("; ")}`, attempts);
}

/** Today's state of every configured provider, for the superadmin pages. */
export async function mailProviderStatus(now = new Date()) {
  const providers = mailProviders();
  const day = usageDay(now);
  const usage = providers.length
    ? new Map((await db.select().from(mailProviderUsage).where(eq(mailProviderUsage.day, day))).map((row) => [row.provider, row]))
    : new Map<string, typeof mailProviderUsage.$inferSelect>();
  return providers.map((provider) => {
    const today = usage.get(provider.name);
    const sent = today?.sent ?? 0;
    const blocked = Boolean(today?.blockedUntil && today.blockedUntil > now);
    const full = provider.dailyLimit > 0 && sent >= provider.dailyLimit;
    return {
      name: provider.name, label: provider.label, sent, failed: today?.failed ?? 0, dailyLimit: provider.dailyLimit,
      state: full ? "full" as const : blocked ? "paused" as const : "ready" as const,
      blockedUntil: blocked ? today!.blockedUntil : null, lastError: today?.lastError ?? null,
    };
  });
}

export function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[char]!);
}
