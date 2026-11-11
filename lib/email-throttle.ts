import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { emailSendCooldowns } from "@/db/schema";

/**
 * Escalating anti-spam limit for emails a person can trigger (password reset, verification link,
 * login code, invitation, account deletion). Per purpose and address, after each email the next one
 * must wait longer: 1 minute, 5 minutes, 1 hour, 5 hours, then 24 hours for every further email.
 * The streak starts over after a quiet day (no request for 24 hours after the wait ended) or when
 * the email did its job (link used, code accepted, invitation accepted): see resetEmailSend.
 * Keeps provider quotas safe and stops one address from being flooded.
 */
export type EmailPurpose = "password_reset" | "verification" | "login_otp" | "invitation" | "account_deletion";

export const EMAIL_SEND_STEPS_MS = [60_000, 5 * 60_000, 60 * 60_000, 5 * 60 * 60_000, 24 * 60 * 60_000];
const RESET_AFTER_MS = 24 * 60 * 60_000;

export type EmailSendDecision =
  | { allowed: true; sendCount: number; nextAllowedAt: Date }
  | { allowed: false; retryAt: Date; retryAfterSeconds: number; message: string };

const key = (purpose: EmailPurpose, email: string) => createHash("sha256").update(`${purpose}:${email.trim().toLowerCase()}`).digest("hex");

/** "45 detik", "4 menit", "1 jam 5 menit", "23 jam 59 menit". */
export function formatWait(ms: number) {
  const seconds = Math.max(1, Math.ceil(ms / 1000));
  if (seconds < 60) return `${seconds} detik`;
  const minutes = Math.ceil(seconds / 60);
  const h = Math.floor(minutes / 60), m = minutes % 60;
  return [h ? `${h} jam` : "", m ? `${m} menit` : ""].filter(Boolean).join(" ");
}

const labels: Record<EmailPurpose, string> = {
  password_reset: "Email atur ulang password",
  verification: "Email verifikasi",
  login_otp: "Kode masuk",
  invitation: "Undangan",
  account_deletion: "Email konfirmasi",
};

export function emailWaitMessage(purpose: EmailPurpose, retryAt: Date, now = new Date()) {
  return `${labels[purpose]} baru saja dikirim. Untuk mencegah spam, permintaan berikutnya bisa dilakukan dalam ${formatWait(retryAt.getTime() - now.getTime())}.`;
}

function blocked(purpose: EmailPurpose, retryAt: Date, now: Date): EmailSendDecision {
  return { allowed: false, retryAt, retryAfterSeconds: Math.ceil((retryAt.getTime() - now.getTime()) / 1000), message: emailWaitMessage(purpose, retryAt, now) };
}

/** Whether an email may be sent now, without using up the turn (for a check before other work). */
export async function peekEmailSend(purpose: EmailPurpose, email: string, now = new Date()): Promise<EmailSendDecision> {
  const [row] = await db.select().from(emailSendCooldowns).where(eq(emailSendCooldowns.emailHash, key(purpose, email))).limit(1);
  if (row && row.nextAllowedAt > now) return blocked(purpose, row.nextAllowedAt, now);
  return { allowed: true, sendCount: row?.sendCount ?? 0, nextAllowedAt: now };
}

/**
 * Takes the turn to send one email: when allowed, records it and sets the next wait. Concurrent
 * requests for the same address are serialized by the row lock, so only one of them gets through.
 */
export async function reserveEmailSend(purpose: EmailPurpose, email: string, now = new Date()): Promise<EmailSendDecision> {
  const emailHash = key(purpose, email);
  return db.transaction(async (tx) => {
    await tx.insert(emailSendCooldowns).values({ emailHash, nextAllowedAt: new Date(0), sendCount: 0 }).onConflictDoNothing();
    const [row] = await tx.select().from(emailSendCooldowns).where(eq(emailSendCooldowns.emailHash, emailHash)).for("update").limit(1);
    if (row.nextAllowedAt > now) return blocked(purpose, row.nextAllowedAt, now);
    const quiet = now.getTime() - row.nextAllowedAt.getTime() >= RESET_AFTER_MS;
    const sendCount = (quiet ? 0 : row.sendCount) + 1;
    const nextAllowedAt = new Date(now.getTime() + EMAIL_SEND_STEPS_MS[Math.min(sendCount, EMAIL_SEND_STEPS_MS.length) - 1]);
    await tx.update(emailSendCooldowns).set({ sendCount, nextAllowedAt, lastSentAt: now, updatedAt: now }).where(eq(emailSendCooldowns.emailHash, emailHash));
    return { allowed: true as const, sendCount, nextAllowedAt };
  });
}

/** The email did its job (link used, code accepted...): the next request starts at 1 minute again. */
export async function resetEmailSend(purpose: EmailPurpose, email: string) {
  await db.delete(emailSendCooldowns).where(eq(emailSendCooldowns.emailHash, key(purpose, email)));
}
