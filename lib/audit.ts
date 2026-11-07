import { eq } from "drizzle-orm";
import { db } from "@/db";
import { companies, platformAuditLogs } from "@/db/schema";

/** Labels for every audited superadmin action, grouped for the log filter. */
export const AUDIT_ACTIONS = {
  "company.enter": "Masuk ke perusahaan",
  "company.plan_set": "Ubah paket perusahaan",
  "company.dates_update": "Ubah tanggal terdaftar / jatuh tempo",
  "subscription.manual_extend": "Perpanjang manual",
  "payment.verify": "Verifikasi pembayaran",
  "payment.reject": "Tolak pembayaran",
  "payment.gateway": "Pembayaran Midtrans diterima",
  "custom_plan.approve": "Setujui Paket Custom",
  "custom_plan.reject": "Tolak Paket Custom",
  "plan.create": "Tambah paket",
  "plan.update": "Ubah paket",
  "plan.delete": "Hapus / nonaktifkan paket",
  "coupon.create": "Buat kupon",
  "coupon.update": "Ubah kupon",
  "coupon.delete": "Hapus kupon",
  "announcement.create": "Buat pengumuman platform",
  "announcement.update": "Ubah pengumuman platform",
  "announcement.delete": "Hapus pengumuman platform",
  "settings.update": "Ubah pengaturan platform",
  "user.role_update": "Ubah peran akun",
  "user.password_reset": "Reset password akun",
  "user.delete": "Hapus akun",
  "deletion_request.process": "Proses permintaan hapus akun",
  "deletion_request.reject": "Tolak permintaan hapus akun",
} as const;
export type AuditAction = keyof typeof AUDIT_ACTIONS;

type Actor = { user: { id: string; name: string; email: string } };

/**
 * Records a privileged action. Pass the transaction when the change itself runs in one, so the
 * entry is written (or rolled back) together with it.
 */
export async function recordAudit(
  actor: Actor,
  entry: { action: AuditAction; summary: string; companyId?: string | null; metadata?: Record<string, unknown> },
  executor: Pick<typeof db, "insert" | "select"> = db,
) {
  let companyName: string | null = null;
  if (entry.companyId) {
    const [company] = await executor.select({ name: companies.name }).from(companies).where(eq(companies.id, entry.companyId)).limit(1);
    companyName = company?.name ?? null;
  }
  await executor.insert(platformAuditLogs).values({
    actorUserId: actor.user.id,
    actorName: actor.user.name,
    actorEmail: actor.user.email,
    action: entry.action,
    companyId: entry.companyId ?? null,
    companyName,
    summary: entry.summary,
    metadata: entry.metadata ?? {},
  });
}
