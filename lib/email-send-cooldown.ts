import { createHash } from "node:crypto";
import { pool } from "@/db";

export const EMAIL_RESEND_COOLDOWN_SECONDS = 60;

function emailHash(email: string) {
  return createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
}

export async function getEmailResendWaitSeconds(email: string) {
  if (!email) return 0;
  const result = await pool.query<{ next_allowed_at: Date }>(
    'SELECT next_allowed_at FROM email_send_cooldowns WHERE email_hash = $1',
    [emailHash(email)],
  );
  const nextAllowedAt = result.rows[0]?.next_allowed_at;
  return nextAllowedAt ? Math.max(0, Math.ceil((new Date(nextAllowedAt).getTime() - Date.now()) / 1000)) : 0;
}

export async function reserveEmailResend(email: string) {
  const nextAllowedAt = new Date(Date.now() + EMAIL_RESEND_COOLDOWN_SECONDS * 1000);
  const hash = emailHash(email);
  const result = await pool.query<{ next_allowed_at: Date }>(
    `INSERT INTO email_send_cooldowns (email_hash, next_allowed_at)
     VALUES ($1, $2)
     ON CONFLICT (email_hash) DO UPDATE
       SET next_allowed_at = EXCLUDED.next_allowed_at, updated_at = now()
       WHERE email_send_cooldowns.next_allowed_at <= now()
     RETURNING next_allowed_at`,
    [hash, nextAllowedAt],
  );
  if (result.rows.length) return { allowed: true as const, nextAllowedAt };
  return { allowed: false as const, retryAfter: Math.max(1, await getEmailResendWaitSeconds(email)) };
}

export async function releaseEmailResend(email: string, nextAllowedAt: Date) {
  await pool.query(
    'DELETE FROM email_send_cooldowns WHERE email_hash = $1 AND next_allowed_at = $2',
    [emailHash(email), nextAllowedAt],
  );
}

export async function markEmailSent(email: string) {
  const nextAllowedAt = new Date(Date.now() + EMAIL_RESEND_COOLDOWN_SECONDS * 1000);
  await pool.query(
    `INSERT INTO email_send_cooldowns (email_hash, next_allowed_at)
     VALUES ($1, $2)
     ON CONFLICT (email_hash) DO UPDATE
       SET next_allowed_at = EXCLUDED.next_allowed_at, updated_at = now()`,
    [emailHash(email), nextAllowedAt],
  );
}
