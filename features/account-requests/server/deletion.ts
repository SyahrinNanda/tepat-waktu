import { createHash, randomBytes } from "node:crypto";
import { and, count, eq, gt, inArray, isNotNull, isNull, ne } from "drizzle-orm";
import { db } from "@/db";
import { companies, companyMembers, deletionRequests, user } from "@/db/schema";
import { sendMail } from "@/lib/mailer";
import { renderBrandedEmail } from "@/lib/registration/auth-emails";

/** How long the emailed confirmation link stays valid. */
export const CONFIRM_TTL_MS = 24 * 60 * 60 * 1000;
/** A new confirmation email for the same account is sent at most this often. */
const RESEND_COOLDOWN_MS = 2 * 60 * 1000;

/** Same answer whether or not the email exists, so the form cannot be used to probe accounts. */
export const DELETION_REQUEST_MESSAGE =
  "Jika email tersebut terdaftar, kami sudah mengirim tautan konfirmasi ke inbox-nya. Permintaan baru diteruskan ke administrator setelah tautan itu diklik (berlaku 24 jam). Akun Anda belum dihapus.";

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

function appUrl(path: string) {
  const base = (process.env.BETTER_AUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/+$/, "");
  return `${base}${path}`;
}

/** Fire-and-forget delivery through the provider fallback; failures are logged, never thrown. */
function deliver(to: string, kind: string, email: ReturnType<typeof renderBrandedEmail>) {
  void sendMail({ to: [to], ...email })
    .then((delivery) => console.info(`Email ${kind} untuk ${to} dikirim lewat ${delivery.label}.`))
    .catch((error) => console.error(`Email ${kind} untuk ${to} gagal dikirim:`, error instanceof Error ? error.message : error));
}

/**
 * Starts a deletion request: stores it unconfirmed and emails the owner a confirmation link.
 * Unknown emails, an already-queued request, or a request made minutes ago send nothing.
 */
export async function requestAccountDeletion(rawEmail: string, reason: string | null, now = new Date()) {
  const email = rawEmail.trim().toLowerCase();
  const [account] = await db.select({ id: user.id, name: user.name }).from(user).where(eq(user.email, email)).limit(1);
  if (!account) return;

  const open = await db.select({ confirmedAt: deletionRequests.confirmedAt, createdAt: deletionRequests.createdAt })
    .from(deletionRequests)
    .where(and(eq(deletionRequests.userId, account.id), eq(deletionRequests.status, "pending")));
  if (open.some((row) => row.confirmedAt)) return; // Already waiting for review.
  if (open.some((row) => now.getTime() - row.createdAt.getTime() < RESEND_COOLDOWN_MS)) return;

  const token = randomBytes(32).toString("base64url");
  await db.transaction(async (tx) => {
    // Only the newest link stays usable.
    await tx.delete(deletionRequests).where(and(eq(deletionRequests.userId, account.id), eq(deletionRequests.status, "pending"), isNull(deletionRequests.confirmedAt)));
    await tx.insert(deletionRequests).values({ email, userId: account.id, reason, tokenHash: hashToken(token), tokenExpiresAt: new Date(now.getTime() + CONFIRM_TTL_MS), createdAt: now });
  });

  deliver(email, "konfirmasi hapus akun", renderBrandedEmail({
    subject: "Konfirmasi permintaan hapus akun TepatWaktu",
    eyebrow: "Penghapusan akun",
    title: "Konfirmasi permintaan hapus akun",
    body: `Halo ${account.name}, kami menerima permintaan untuk menghapus akun TepatWaktu dengan email ini. Klik tombol di bawah untuk mengonfirmasi. Setelah itu permintaan ditinjau administrator, dan Anda akan menerima email saat permintaan diproses.`,
    cta: "Konfirmasi Hapus Akun",
    url: appUrl(`/penghapusan-akun/konfirmasi?token=${token}`),
    note: "Tautan berlaku 24 jam. Jika Anda tidak meminta penghapusan akun, abaikan email ini; akun Anda tetap aman dan tidak berubah.",
  }));
}

/** Request matching a still-valid, unconfirmed link, or null. */
export async function findConfirmableRequest(token: string, now = new Date()) {
  if (!token || token.length > 200) return null;
  const [row] = await db.select({ id: deletionRequests.id, email: deletionRequests.email })
    .from(deletionRequests)
    .where(and(eq(deletionRequests.tokenHash, hashToken(token)), eq(deletionRequests.status, "pending"), isNull(deletionRequests.confirmedAt), gt(deletionRequests.tokenExpiresAt, now)))
    .limit(1);
  return row ?? null;
}

/** Marks the request confirmed (queued for review) and burns the token. Returns false if the link is invalid. */
export async function confirmAccountDeletion(token: string, now = new Date()) {
  const row = await findConfirmableRequest(token, now);
  if (!row) return false;
  const updated = await db.update(deletionRequests)
    .set({ confirmedAt: now, tokenHash: null })
    .where(and(eq(deletionRequests.id, row.id), isNull(deletionRequests.confirmedAt)))
    .returning({ id: deletionRequests.id });
  return updated.length > 0;
}

/** Number of confirmed requests waiting for a superadmin decision. */
export async function pendingDeletionCount() {
  const [row] = await db.select({ value: count() }).from(deletionRequests)
    .where(and(eq(deletionRequests.status, "pending"), isNotNull(deletionRequests.confirmedAt)));
  return Number(row?.value ?? 0);
}

export function sendDeletionOutcomeEmail(to: string, outcome: "processed" | "rejected", note?: string | null) {
  deliver(to, `hasil hapus akun (${outcome})`, outcome === "processed"
    ? renderBrandedEmail({
      subject: "Akun TepatWaktu Anda telah dihapus",
      eyebrow: "Penghapusan akun",
      title: "Akun Anda telah dihapus",
      body: "Sesuai permintaan Anda, akun TepatWaktu dengan email ini sudah dihapus beserta seluruh sesi login dan keanggotaan perusahaannya. Anda tidak bisa lagi masuk dengan akun ini.",
      note: "Jika Anda merasa tidak pernah meminta penghapusan ini, segera hubungi tim TepatWaktu dengan membalas email ini.",
    })
    : renderBrandedEmail({
      subject: "Permintaan hapus akun TepatWaktu ditolak",
      eyebrow: "Penghapusan akun",
      title: "Permintaan hapus akun belum bisa diproses",
      body: `Permintaan penghapusan akun TepatWaktu dengan email ini ditolak administrator, sehingga akun Anda tetap aktif.${note ? `\n\nAlasan: ${note}` : ""}`,
      note: "Anda bisa mengajukan permintaan baru setelah menindaklanjuti alasan di atas, atau membalas email ini jika ada pertanyaan.",
    }));
}

const ADMIN_ROLES = ["owner", "admin"] as const;

/**
 * Companies where this user is the only active admin. Deleting the account would leave them
 * without anyone who can manage the company, so processing is blocked until another admin exists.
 */
export async function companiesLeftWithoutAdmin(userId: string, executor: Pick<typeof db, "select"> = db) {
  const adminOf = await executor.select({ companyId: companyMembers.companyId, name: companies.name })
    .from(companyMembers).innerJoin(companies, eq(companies.id, companyMembers.companyId))
    .where(and(eq(companyMembers.userId, userId), eq(companyMembers.isActive, true), inArray(companyMembers.role, [...ADMIN_ROLES])));
  if (!adminOf.length) return [];
  const others = await executor.select({ companyId: companyMembers.companyId }).from(companyMembers)
    .where(and(inArray(companyMembers.companyId, adminOf.map((row) => row.companyId)), ne(companyMembers.userId, userId), eq(companyMembers.isActive, true), inArray(companyMembers.role, [...ADMIN_ROLES])));
  const covered = new Set(others.map((row) => row.companyId));
  return adminOf.filter((row) => !covered.has(row.companyId)).map((row) => row.name);
}
