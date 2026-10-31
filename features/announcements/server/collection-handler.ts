import { and, desc, eq, ilike, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { announcements } from "@/db/schema";
import { featureContext } from "@/features/generic-modules/server/feature-records";
import { ImageUploadError, removeStoredAsset, storeAnnouncementImage } from "@/features/announcements/server/image-upload";

export const runtime = "nodejs";

const inputSchema = z.object({
  title: z.string().trim().min(3).max(160),
  summary: z.string().trim().min(3).max(320),
  content: z.string().trim().min(3).max(30000),
});

export async function GET(request: Request) {
  const context = await featureContext(request, "pengumuman", "read");
  if ("error" in context) return context.error;
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  const rows = await db.select().from(announcements).where(and(
    eq(announcements.companyId, context.companyId),
    query ? or(ilike(announcements.title, `%${query}%`), ilike(announcements.summary, `%${query}%`)) : undefined,
  )).orderBy(desc(announcements.createdAt)).limit(500);
  return Response.json({ rows });
}

export async function POST(request: Request) {
  let asset: Awaited<ReturnType<typeof storeAnnouncementImage>> | undefined;
  try {
    const context = await featureContext(request, "pengumuman", "write");
    if ("error" in context) return context.error;
    const form = await request.formData();
    const parsed = inputSchema.safeParse({ title: form.get("title"), summary: form.get("summary"), content: form.get("content") });
    if (!parsed.success) return Response.json({ error: "Judul, deskripsi singkat, dan isi pengumuman wajib diisi dengan benar." }, { status: 400 });
    const image = form.get("image");
    if (image instanceof File && image.size > 0) asset = await storeAnnouncementImage(image, context.companyId, context.userId);
    const [row] = await db.insert(announcements).values({
      companyId: context.companyId, imageAssetId: asset?.id, ...parsed.data, createdBy: context.userId,
    }).returning();
    revalidatePath("/dashboard/pengumuman");
    return Response.json({ row }, { status: 201 });
  } catch (error) {
    if (asset) await removeStoredAsset(asset).catch(() => undefined);
    if (error instanceof ImageUploadError) return Response.json({ error: error.message }, { status: error.status });
    console.error("Create announcement failed", error);
    return Response.json({ error: "Pengumuman belum dapat disimpan." }, { status: 500 });
  }
}
