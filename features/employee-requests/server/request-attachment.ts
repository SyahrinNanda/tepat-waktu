import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { fileAssets } from "@/db/schema";
import { deletePrivateObject } from "@/lib/object-storage";

/**
 * Attachments of Izin/Cuti and Lembur requests. The file is uploaded first through
 * /api/feature-uploads (PDF/JPEG/PNG/WebP, max 8 MB); the request then refers to the asset id.
 */

/**
 * Checks that the asset was just uploaded by this user in this company, then hands it to the
 * employee of the request so that employee can open it too (an admin may file for someone else).
 */
export async function claimRequestAttachment(context: { companyId: string; userId: string }, assetId: string, employeeId: string) {
  const [asset] = await db.select({ id: fileAssets.id, name: fileAssets.originalName }).from(fileAssets)
    .where(and(eq(fileAssets.id, assetId), eq(fileAssets.companyId, context.companyId), eq(fileAssets.uploadedBy, context.userId), eq(fileAssets.category, "employee_document")))
    .limit(1);
  if (!asset) return null;
  await db.update(fileAssets).set({ ownerEmployeeId: employeeId }).where(eq(fileAssets.id, assetId));
  return { id: asset.id, name: asset.name };
}

/** Removes a replaced or orphaned attachment (database row + stored object). Never fails the caller. */
export async function removeRequestAttachment(assetId: string | null | undefined) {
  if (!assetId) return;
  try {
    const [asset] = await db.delete(fileAssets).where(eq(fileAssets.id, assetId)).returning({ bucket: fileAssets.bucket, key: fileAssets.objectKey });
    if (asset) await deletePrivateObject(asset.bucket, asset.key);
  } catch (error) {
    console.error("Lampiran pengajuan gagal dihapus:", error);
  }
}

export const ATTACHMENT_INVALID = "Lampiran tidak valid. Unggah ulang file lampiran.";
