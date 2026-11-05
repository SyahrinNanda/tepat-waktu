import { gzip } from "node:zlib";
import { promisify } from "node:util";
import sharp from "sharp";

const gzipAsync = promisify(gzip);

/**
 * How hard an uploaded image may be shrunk.
 * - selfie: check-in / visit selfies, only viewed on screen → 1280 px, quality 60.
 * - detail: documents, attachments, announcement images where text must stay legible → 1920 px, quality 65.
 */
export const IMAGE_PROFILES = {
  selfie: { maxSize: 1280, quality: 60 },
  detail: { maxSize: 1920, quality: 65 },
} as const;
export type ImageProfile = keyof typeof IMAGE_PROFILES;

export type CompressedUpload = {
  bytes: Uint8Array;
  /** Type of the stored bytes: images become image/webp; documents keep their own type. */
  contentType: string;
  /** File extension matching contentType (without dot). */
  extension: string;
  /** Set when a document is stored gzip-compressed (expanded transparently on download). */
  storageCompression?: "gzip";
  /** WebP quality used, for object metadata. */
  quality?: number;
};

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

/**
 * Compresses an upload before it is stored.
 * Images are re-encoded as WebP (EXIF/GPS metadata stripped, rotated upright, downscaled to the
 * profile's max size). Documents (PDF/XLSX/DOCX...) must stay byte-perfect, so they are only
 * gzip-compressed losslessly for storage.
 */
export async function compressUpload(bytes: Uint8Array, contentType: string, extension: string, profile: ImageProfile = "detail"): Promise<CompressedUpload> {
  if (IMAGE_TYPES.has(contentType)) {
    const { maxSize, quality } = IMAGE_PROFILES[profile];
    const resized = () => sharp(bytes, { failOn: "error", limitInputPixels: 40_000_000 })
      .autoOrient()
      .resize({ width: maxSize, height: maxSize, fit: "inside", withoutEnlargement: true });
    const candidates: CompressedUpload[] = [
      { bytes: new Uint8Array(await resized().webp({ quality, effort: 4, smartSubsample: true }).toBuffer()), contentType: "image/webp", extension: "webp", quality },
    ];
    // Screenshots and scans with text (usually PNG) are often smaller, and sharper, as palette PNG.
    if (contentType === "image/png") {
      candidates.push({ bytes: new Uint8Array(await resized().png({ palette: true, quality: 80, compressionLevel: 9 }).toBuffer()), contentType: "image/png", extension: "png", quality: 80 });
    }
    const best = candidates.reduce((smallest, next) => next.bytes.byteLength < smallest.bytes.byteLength ? next : smallest);
    // A tiny, already-optimised image can grow when re-encoded: keep the original then.
    return best.bytes.byteLength < bytes.byteLength ? best : { bytes, contentType, extension };
  }

  const compressed = new Uint8Array(await gzipAsync(bytes, { level: 9 }));
  return compressed.byteLength < bytes.byteLength
    ? { bytes: compressed, contentType, extension, storageCompression: "gzip" }
    : { bytes, contentType, extension };
}

/** Keeps the user's file name but swaps the extension to match the stored format. */
export function storedFileName(originalName: string | undefined | null, fallbackBase: string, extension: string) {
  const base = (originalName || fallbackBase).replace(/\.[A-Za-z0-9]{1,5}$/, "");
  return `${base || fallbackBase}.${extension}`;
}
