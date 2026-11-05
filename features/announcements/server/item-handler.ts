import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { announcements, fileAssets } from "@/db/schema";
import { featureContext } from "@/features/generic-modules/server/feature-records";
import { ImageUploadError, removeStoredAsset, storeAnnouncementImage } from "@/features/announcements/server/image-upload";

export const runtime = "nodejs";
type Params = { params: Promise<{ id: string }> };
const inputSchema = z.object({ title: z.string().trim().min(3).max(160), summary: z.string().trim().min(3).max(320), content: z.string().trim().min(3).max(30000) });

export async function PATCH(request: Request, { params }: Params) {
  try {
    const context = await featureContext(request, "pengumuman", "write");
    if ("error" in context) return context.error;
    const { id } = await params;
    const [current] = await db.select().from(announcements).where(and(eq(announcements.id, id), eq(announcements.companyId, context.companyId))).limit(1);
    if (!current) return Response.json({ error: "Pemberitahuan tidak ditemukan." }, { status: 404 });
    const form = await request.formData();
    const parsed = inputSchema.safeParse({ title: form.get("title"), summary: form.get("summary"), content: form.get("content") });
    if (!parsed.success) return Response.json({ error: "Data pemberitahuan tidak valid." }, { status: 400 });
    const image = form.get("image");
    const newAsset = image instanceof File && image.size > 0 ? await storeAnnouncementImage(image, context.companyId, context.userId) : undefined;
    const [row] = await db.update(announcements).set({ ...parsed.data, imageAssetId: newAsset?.id ?? current.imageAssetId, updatedBy: context.userId, updatedAt: new Date() })
      .where(and(eq(announcements.id, id), eq(announcements.companyId, context.companyId))).returning();
    if (newAsset && current.imageAssetId) {
      const [old] = await db.select().from(fileAssets).where(eq(fileAssets.id, current.imageAssetId)).limit(1);
      await removeStoredAsset(old);
    }
    revalidatePath("/dashboard/pengumuman");
    return Response.json({ row });
  } catch (error) {
    if (error instanceof ImageUploadError) return Response.json({ error: error.message }, { status: error.status });
    console.error("Update announcement failed", error);
    return Response.json({ error: "Perubahan belum dapat disimpan." }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: Params) {
  try {
    const context = await featureContext(request, "pengumuman", "manage");
    if ("error" in context) return context.error;
    const { id } = await params;
    const [current] = await db.select().from(announcements).where(and(eq(announcements.id, id), eq(announcements.companyId, context.companyId))).limit(1);
    if (!current) return Response.json({ error: "Pemberitahuan tidak ditemukan." }, { status: 404 });
    const [asset] = current.imageAssetId ? await db.select().from(fileAssets).where(eq(fileAssets.id, current.imageAssetId)).limit(1) : [];
    await db.delete(announcements).where(and(eq(announcements.id, id), eq(announcements.companyId, context.companyId)));
    await removeStoredAsset(asset);
    revalidatePath("/dashboard/pengumuman");
    return Response.json({ ok: true });
  } catch (error) {
    console.error("Delete announcement failed", error);
    return Response.json({ error: "Pemberitahuan belum dapat dihapus." }, { status: 500 });
  }
}
