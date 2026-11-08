import { createHash, randomBytes } from "node:crypto";
import { and, desc, eq, gt, inArray, isNull } from "drizzle-orm";
import { hashPassword } from "better-auth/crypto";
import { db } from "@/db";
import { account, companies, companyMembers, session, user, userInvitations } from "@/db/schema";
import { sendMail } from "@/lib/mailer";
import { renderBrandedEmail } from "@/lib/registration/auth-emails";

/** How long an emailed invitation link stays valid. */
export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
/** A new invitation for the same user can be sent at most this often. */
export const INVITE_RESEND_COOLDOWN_MS = 60 * 1000;

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

function appUrl(path: string) {
  const base = (process.env.BETTER_AUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/+$/, "");
  return `${base}${path}`;
}

/** Random password for an account whose owner will set their own through the invitation. Never shown. */
export function unusablePassword() {
  return `${randomBytes(32).toString("base64url")}Aa1!`;
}

export class InvitationError extends Error {}

/**
 * Replaces any pending invitation of the user with a new one and emails the link.
 * Returns false when the email could not be sent (the invitation is kept; the admin can resend).
 */
export async function createAndSendInvitation(input: {
  companyId: string; userId: string; email: string; name: string; roleLabel: string; invitedBy: string; inviterName: string; now?: Date;
}) {
  const now = input.now ?? new Date();
  const [latest] = await db.select({ createdAt: userInvitations.createdAt }).from(userInvitations)
    .where(and(eq(userInvitations.userId, input.userId), eq(userInvitations.companyId, input.companyId), isNull(userInvitations.acceptedAt)))
    .orderBy(desc(userInvitations.createdAt)).limit(1);
  if (latest && now.getTime() - latest.createdAt.getTime() < INVITE_RESEND_COOLDOWN_MS) {
    throw new InvitationError("Undangan baru saja dikirim. Tunggu satu menit sebelum mengirim ulang.");
  }
  const [company] = await db.select({ name: companies.name }).from(companies).where(eq(companies.id, input.companyId)).limit(1);
  if (!company) throw new InvitationError("Perusahaan tidak ditemukan.");

  const token = randomBytes(32).toString("base64url");
  await db.transaction(async (tx) => {
    // Only the newest link works.
    await tx.delete(userInvitations).where(and(eq(userInvitations.userId, input.userId), eq(userInvitations.companyId, input.companyId), isNull(userInvitations.acceptedAt)));
    await tx.insert(userInvitations).values({
      companyId: input.companyId, userId: input.userId, email: input.email.toLowerCase(), tokenHash: hashToken(token),
      expiresAt: new Date(now.getTime() + INVITE_TTL_MS), invitedBy: input.invitedBy, createdAt: now,
    });
  });

  const email = renderBrandedEmail({
    subject: `Undangan bergabung ke ${company.name} di TepatWaktu`,
    eyebrow: "Undangan",
    title: `Anda diundang ke ${company.name}`,
    body: `Halo ${input.name}, ${input.inviterName} menambahkan Anda sebagai ${input.roleLabel} di ${company.name} pada TepatWaktu. Klik tombol di bawah untuk membuat password Anda sendiri, lalu masuk dengan email ${input.email.toLowerCase()}.`,
    cta: "Buat Password",
    url: appUrl(`/undangan?token=${token}`),
    note: "Tautan berlaku 7 hari dan hanya bisa dipakai sekali. Jika Anda tidak mengenal perusahaan ini, abaikan email ini.",
  });
  try {
    const delivery = await sendMail({ to: [input.email.toLowerCase()], ...email });
    console.info(`Email undangan untuk ${input.email} dikirim lewat ${delivery.label}.`);
    return true;
  } catch (error) {
    console.error(`Email undangan untuk ${input.email} gagal dikirim:`, error instanceof Error ? error.message : error);
    return false;
  }
}

/** The invitation behind a link, if it is still usable. */
export async function findUsableInvitation(token: string, now = new Date()) {
  if (!token || token.length > 200) return null;
  const [row] = await db.select({
    id: userInvitations.id, userId: userInvitations.userId, companyId: userInvitations.companyId, email: userInvitations.email,
    name: user.name, companyName: companies.name,
  }).from(userInvitations)
    .innerJoin(user, eq(user.id, userInvitations.userId))
    .innerJoin(companies, eq(companies.id, userInvitations.companyId))
    // Still a member of the inviting company (removed members cannot use an old link).
    .innerJoin(companyMembers, and(eq(companyMembers.userId, userInvitations.userId), eq(companyMembers.companyId, userInvitations.companyId)))
    .where(and(eq(userInvitations.tokenHash, hashToken(token)), isNull(userInvitations.acceptedAt), gt(userInvitations.expiresAt, now)))
    .limit(1);
  return row ?? null;
}

/**
 * Sets the user's password from an invitation link. Single use; also marks the email verified
 * (the link proves the address) and signs out any other session of the account.
 */
export async function acceptInvitation(token: string, password: string, now = new Date()) {
  if (password.length < 8 || password.length > 128) throw new InvitationError("Password harus 8–128 karakter.");
  const invitation = await findUsableInvitation(token, now);
  if (!invitation) throw new InvitationError("Tautan undangan tidak berlaku, sudah dipakai, atau sudah kedaluwarsa.");
  const passwordHash = await hashPassword(password);
  await db.transaction(async (tx) => {
    const claimed = await tx.update(userInvitations).set({ acceptedAt: now })
      .where(and(eq(userInvitations.id, invitation.id), isNull(userInvitations.acceptedAt))).returning({ id: userInvitations.id });
    if (!claimed.length) throw new InvitationError("Tautan undangan sudah dipakai.");
    const updated = await tx.update(account).set({ password: passwordHash, updatedAt: now })
      .where(and(eq(account.userId, invitation.userId), eq(account.providerId, "credential"))).returning({ id: account.id });
    if (!updated.length) {
      await tx.insert(account).values({ id: crypto.randomUUID(), accountId: invitation.userId, providerId: "credential", userId: invitation.userId, password: passwordHash, createdAt: now, updatedAt: now });
    }
    await tx.update(user).set({ emailVerified: true, updatedAt: now }).where(eq(user.id, invitation.userId));
    await tx.delete(session).where(eq(session.userId, invitation.userId));
  });
  return { email: invitation.email, companyName: invitation.companyName };
}

/** Pending invitation per user of a company: "pending" (link still valid) or "expired". */
export async function invitationStatuses(companyId: string, userIds: string[], now = new Date()) {
  const map = new Map<string, "pending" | "expired">();
  if (!userIds.length) return map;
  const rows = await db.select({ userId: userInvitations.userId, expiresAt: userInvitations.expiresAt }).from(userInvitations)
    .where(and(eq(userInvitations.companyId, companyId), inArray(userInvitations.userId, userIds), isNull(userInvitations.acceptedAt)));
  for (const row of rows) map.set(row.userId, row.expiresAt > now ? "pending" : "expired");
  return map;
}
