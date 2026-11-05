"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { deletionRequests, user } from "@/db/schema";
import { companiesLeftWithoutAdmin, sendDeletionOutcomeEmail } from "@/features/account-requests/server/deletion";
import { recordAudit } from "@/lib/audit";
import { requireSuperAdmin } from "@/lib/superadmin";

export type DeletionActionState = { ok?: boolean; error?: string; message?: string };

class BlockedError extends Error {}

export async function processDeletionRequest(_: DeletionActionState, form: FormData): Promise<DeletionActionState> {
  const session = await requireSuperAdmin();
  const id = z.uuid().parse(form.get("id"));
  try {
    const result = await db.transaction(async (tx) => {
      const [request] = await tx.select().from(deletionRequests).where(eq(deletionRequests.id, id)).for("update").limit(1);
      if (!request || request.status !== "pending" || !request.confirmedAt) throw new BlockedError("Permintaan ini sudah diproses atau belum dikonfirmasi pemilik akun.");
      if (request.userId === session.user.id) throw new BlockedError("Anda tidak dapat menghapus akun Anda sendiri.");
      if (request.userId) {
        const [target] = await tx.select({ platformRole: user.platformRole }).from(user).where(eq(user.id, request.userId)).limit(1);
        if (target?.platformRole === "superadmin") throw new BlockedError("Akun ini Super Admin. Cabut perannya di Kelola Seluruh Akun sebelum menghapusnya.");
        const orphaned = await companiesLeftWithoutAdmin(request.userId, tx);
        if (orphaned.length) throw new BlockedError(`Akun ini satu-satunya admin di ${orphaned.join(", ")}. Tunjuk admin lain di perusahaan tersebut terlebih dahulu (Masuk ke perusahaan → Pengaturan → Users), lalu proses lagi.`);
        await recordAudit(session, { action: "deletion_request.process", summary: `Memproses permintaan hapus akun ${request.email}`, metadata: { requestId: id, userId: request.userId, email: request.email } }, tx);
        await tx.delete(user).where(eq(user.id, request.userId));
      } else {
        // The account was already removed elsewhere; just close the request.
        await recordAudit(session, { action: "deletion_request.process", summary: `Menutup permintaan hapus akun ${request.email} (akun sudah tidak ada)`, metadata: { requestId: id, email: request.email } }, tx);
      }
      await tx.update(deletionRequests).set({ status: "processed", processedAt: new Date(), processedBy: session.user.email }).where(eq(deletionRequests.id, id));
      return request.email;
    });
    sendDeletionOutcomeEmail(result, "processed");
  } catch (error) {
    if (error instanceof BlockedError) return { error: error.message };
    throw error;
  }
  revalidatePath("/superadmin/penghapusan-akun");
  revalidatePath("/superadmin/users");
  revalidatePath("/superadmin");
  return { ok: true, message: "Akun dihapus dan pemohon sudah diberi tahu lewat email." };
}

export async function rejectDeletionRequest(_: DeletionActionState, form: FormData): Promise<DeletionActionState> {
  const session = await requireSuperAdmin();
  const id = z.uuid().parse(form.get("id"));
  const note = z.string().trim().max(500, "Alasan maksimal 500 karakter.").safeParse(form.get("note") ?? "");
  if (!note.success) return { error: note.error.issues[0]?.message };
  const [request] = await db.update(deletionRequests)
    .set({ status: "rejected", note: note.data || null, processedAt: new Date(), processedBy: session.user.email, tokenHash: null })
    .where(and(eq(deletionRequests.id, id), eq(deletionRequests.status, "pending")))
    .returning({ email: deletionRequests.email, confirmedAt: deletionRequests.confirmedAt });
  if (!request) return { error: "Permintaan ini sudah diproses." };
  await recordAudit(session, { action: "deletion_request.reject", summary: `Menolak permintaan hapus akun ${request.email}`, metadata: { requestId: id, email: request.email, note: note.data || null } });
  // Only owners who confirmed the request get an outcome email; unconfirmed ones may not be theirs.
  if (request.confirmedAt) sendDeletionOutcomeEmail(request.email, "rejected", note.data || null);
  revalidatePath("/superadmin/penghapusan-akun");
  return { ok: true, message: request.confirmedAt ? "Permintaan ditolak dan pemohon sudah diberi tahu lewat email." : "Permintaan ditolak." };
}
