import { createHash, randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { employees, fileAssets } from "@/db/schema";
import { featureContext } from "@/features/generic-modules/server/feature-records";
import { deletePrivateObject, putPrivateObject } from "@/lib/object-storage";
import { compressUpload } from "@/lib/file-compression";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  const moduleName = form?.get("module");
  const file = form?.get("file");
  if (typeof moduleName !== "string" || !(file instanceof File)) return Response.json({ error: "File dan fitur wajib diisi." }, { status: 400 });
  const context = await featureContext(request, moduleName, "write");
  if ("error" in context) return context.error;
  if (file.size < 1 || file.size > 8 * 1024 * 1024) return Response.json({ error: "Ukuran file harus 1 byte sampai 8 MB." }, { status: 413 });
  const sourceBytes = new Uint8Array(await file.arrayBuffer());
  const format = detectFormat(sourceBytes);
  if (!format) return Response.json({ error: "Format file harus PDF, JPEG, PNG, atau WebP." }, { status: 415 });
  const compressed = await compressUpload(sourceBytes, format.contentType);
  const bytes = compressed.bytes;
  const checksum = createHash("sha256").update(bytes).digest("hex");
  const key = `companies/${context.companyId}/features/${context.module.replaceAll("/", "-")}/${randomUUID()}.${format.extension}`;
  const [employee] = await db.select({ id: employees.id }).from(employees).where(and(eq(employees.companyId, context.companyId), eq(employees.userId, context.userId))).limit(1);
  let stored: { bucket: string; key: string } | undefined;
  try {
    stored = await putPrivateObject({ key, body: bytes, contentType: format.contentType, storageCompression: compressed.storageCompression, metadata: { company: context.companyId, module: context.module, sha256: checksum, uploadQuality: "70" } });
    const [asset] = await db.insert(fileAssets).values({
      companyId: context.companyId, ownerEmployeeId: employee?.id ?? null, uploadedBy: context.userId,
      category: context.module === "pengajuan/klaim-beban" ? "claim_attachment" : "employee_document",
      bucket: stored.bucket, objectKey: stored.key, originalName: file.name || `lampiran.${format.extension}`,
      contentType: format.contentType, byteSize: bytes.byteLength, checksumSha256: checksum,
    }).returning({ id: fileAssets.id });
    return Response.json({ id: asset.id, url: `/api/files/${asset.id}`, name: file.name });
  } catch (error) {
    if (stored) await deletePrivateObject(stored.bucket, stored.key).catch(() => undefined);
    console.error("Feature upload failed", error);
    return Response.json({ error: "File belum dapat diunggah." }, { status: 500 });
  }
}

function detectFormat(bytes: Uint8Array) {
  if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) return { contentType: "application/pdf", extension: "pdf" };
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { contentType: "image/jpeg", extension: "jpg" };
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return { contentType: "image/png", extension: "png" };
  if (String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") return { contentType: "image/webp", extension: "webp" };
  return null;
}
