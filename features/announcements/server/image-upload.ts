import { createHash, randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { fileAssets } from "@/db/schema";
import { deletePrivateObject, putPrivateObject } from "@/lib/object-storage";
import { compressUpload, storedFileName } from "@/lib/file-compression";

const MAX_IMAGE_SIZE = 8 * 1024 * 1024;

export class ImageUploadError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export async function storeAnnouncementImage(file: File, companyId: string, userId: string) {
  if (file.size < 1 || file.size > MAX_IMAGE_SIZE) throw new ImageUploadError("Ukuran gambar harus antara 1 byte dan 8 MB.", 413);
  const sourceBytes = new Uint8Array(await file.arrayBuffer());
  const format = detectImageFormat(sourceBytes);
  if (!format) throw new ImageUploadError("Format gambar harus JPEG, PNG, atau WebP.", 415);
  const compressed = await compressUpload(sourceBytes, format.contentType, format.extension, "detail");
  const bytes = compressed.bytes;
  const checksum = createHash("sha256").update(bytes).digest("hex");
  const key = `companies/${companyId}/announcements/${randomUUID()}.${compressed.extension}`;
  let stored: { bucket: string; key: string } | undefined;
  try {
    stored = await putPrivateObject({ key, body: bytes, contentType: compressed.contentType, storageCompression: compressed.storageCompression, metadata: { company: companyId, sha256: checksum, uploadQuality: String(compressed.quality ?? "original") } });
    const [asset] = await db.insert(fileAssets).values({
      companyId, uploadedBy: userId, category: "announcement_image", bucket: stored.bucket,
      objectKey: stored.key, originalName: storedFileName(file.name, "pengumuman", compressed.extension),
      contentType: compressed.contentType, byteSize: bytes.byteLength, checksumSha256: checksum,
    }).returning();
    return asset;
  } catch (error) {
    if (stored) await deletePrivateObject(stored.bucket, stored.key).catch(() => undefined);
    throw error;
  }
}

export async function removeStoredAsset(asset: typeof fileAssets.$inferSelect | null | undefined) {
  if (!asset) return;
  await db.delete(fileAssets).where(eq(fileAssets.id, asset.id));
  await deletePrivateObject(asset.bucket, asset.objectKey).catch((error) => console.error("Gagal menghapus object lama", error));
}

function detectImageFormat(bytes: Uint8Array) {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { contentType: "image/jpeg", extension: "jpg" };
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return { contentType: "image/png", extension: "png" };
  if (String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") return { contentType: "image/webp", extension: "webp" };
  return null;
}
