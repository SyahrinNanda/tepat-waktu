import { gzip } from "node:zlib";
import { promisify } from "node:util";
import sharp from "sharp";

const gzipAsync = promisify(gzip);

export const UPLOAD_IMAGE_QUALITY = 70;

export type CompressedUpload = {
  bytes: Uint8Array;
  storageCompression?: "gzip";
};

/** Compresses persisted uploads without changing their public content type. */
export async function compressUpload(bytes: Uint8Array, contentType: string): Promise<CompressedUpload> {
  const image = () => sharp(bytes, { failOn: "error", limitInputPixels: 40_000_000 })
    .autoOrient()
    .resize({ width: 2560, height: 2560, fit: "inside", withoutEnlargement: true });

  const keepSmallerImage = (encoded: Uint8Array): CompressedUpload => ({
    bytes: encoded.byteLength < bytes.byteLength ? encoded : bytes,
  });

  if (contentType === "image/jpeg") {
    return keepSmallerImage(await image().jpeg({ quality: UPLOAD_IMAGE_QUALITY, progressive: true, mozjpeg: true }).toBuffer());
  }
  if (contentType === "image/png") {
    return keepSmallerImage(await image().png({ quality: UPLOAD_IMAGE_QUALITY, compressionLevel: 9, palette: true }).toBuffer());
  }
  if (contentType === "image/webp") {
    return keepSmallerImage(await image().webp({ quality: UPLOAD_IMAGE_QUALITY, effort: 6 }).toBuffer());
  }

  // PDF/XLSX/DOCX and other documents must remain byte-perfect. Compress the
  // stored object losslessly and transparently expand it when downloaded.
  const compressed = new Uint8Array(await gzipAsync(bytes, { level: 9 }));
  return compressed.byteLength < bytes.byteLength
    ? { bytes: compressed, storageCompression: "gzip" }
    : { bytes };
}
