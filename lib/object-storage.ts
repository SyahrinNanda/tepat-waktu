import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { gunzip } from "node:zlib";
import { promisify } from "node:util";

const gunzipAsync = promisify(gunzip);

type StorageConfig = {
  endpoint?: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle: boolean;
  autoCreateBucket: boolean;
};

function readBoolean(value: string | undefined, fallback = false) {
  if (value === undefined) return fallback;
  return value === "true" || value === "1";
}

function getConfig(): StorageConfig {
  const accessKeyId = process.env.OBJECT_STORAGE_ACCESS_KEY;
  const secretAccessKey = process.env.OBJECT_STORAGE_SECRET_KEY;
  const bucket = process.env.OBJECT_STORAGE_BUCKET;
  if (!accessKeyId || !secretAccessKey || !bucket) {
    throw new Error("Konfigurasi object storage belum lengkap.");
  }
  return {
    endpoint: process.env.OBJECT_STORAGE_ENDPOINT || undefined,
    region: process.env.OBJECT_STORAGE_REGION || "us-east-1",
    bucket,
    accessKeyId,
    secretAccessKey,
    forcePathStyle: readBoolean(process.env.OBJECT_STORAGE_FORCE_PATH_STYLE, Boolean(process.env.OBJECT_STORAGE_ENDPOINT)),
    autoCreateBucket: readBoolean(process.env.OBJECT_STORAGE_AUTO_CREATE_BUCKET),
  };
}

const globalStorage = globalThis as unknown as { objectStorageClient?: S3Client; objectStorageBucketReady?: Promise<void> };

function getClient() {
  if (!globalStorage.objectStorageClient) {
    const config = getConfig();
    globalStorage.objectStorageClient = new S3Client({
      endpoint: config.endpoint,
      region: config.region,
      forcePathStyle: config.forcePathStyle,
      // Older S3-compatible servers (including the local SeaweedFS gateway)
      // may not implement the newer optional checksum headers sent by default.
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
      credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
    });
  }
  return globalStorage.objectStorageClient;
}

export function objectStorageBucket() {
  return getConfig().bucket;
}

export async function ensureObjectStorageBucket() {
  if (!globalStorage.objectStorageBucketReady) {
    globalStorage.objectStorageBucketReady = (async () => {
      const config = getConfig();
      const client = getClient();
      try {
        await client.send(new HeadBucketCommand({ Bucket: config.bucket }));
      } catch (error) {
        if (!config.autoCreateBucket) throw error;
        await client.send(new CreateBucketCommand({ Bucket: config.bucket }));
      }
    })().catch((error) => {
      globalStorage.objectStorageBucketReady = undefined;
      throw error;
    });
  }
  return globalStorage.objectStorageBucketReady;
}

export async function putPrivateObject(input: { key: string; body: Uint8Array; contentType: string; metadata?: Record<string, string>; storageCompression?: "gzip" }) {
  await ensureObjectStorageBucket();
  const bucket = objectStorageBucket();
  await getClient().send(new PutObjectCommand({
    Bucket: bucket,
    Key: input.key,
    Body: input.body,
    ContentType: input.contentType,
    CacheControl: "private, max-age=300",
    Metadata: { ...input.metadata, ...(input.storageCompression ? { storageCompression: input.storageCompression } : {}) },
  }));
  return { bucket, key: input.key };
}

export async function getPrivateObject(bucket: string, key: string) {
  const result = await getClient().send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  if (!result.Body) throw new Error("File object storage tidak memiliki isi.");
  const storedBytes = await result.Body.transformToByteArray();
  const bytes = result.Metadata?.storagecompression === "gzip" ? new Uint8Array(await gunzipAsync(storedBytes)) : storedBytes;
  return {
    bytes,
    contentType: result.ContentType || "application/octet-stream",
    contentLength: bytes.byteLength,
    etag: result.ETag,
  };
}

export async function deletePrivateObject(bucket: string, key: string) {
  await getClient().send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}
