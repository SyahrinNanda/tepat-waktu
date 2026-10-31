import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { featureRecords } from "@/db/schema";
import { featureContext, scopedFeatureRecord } from "@/features/generic-modules/server/feature-records";
import { canManageFeature, canWriteFeature } from "@/features/generic-modules/config/feature-modules";

type Params = { params: Promise<{ id: string }> };
const updateSchema = z.object({ module: z.string(), fields: z.record(z.string().min(1).max(100), z.string().trim().max(1000)).optional(), status: z.string().trim().max(40).optional() });

export async function GET(request: Request, { params }: Params) {
  const featureName = new URL(request.url).searchParams.get("module") ?? "";
  const context = await featureContext(request, featureName, "read");
  if ("error" in context) return context.error;
  const record = await scopedFeatureRecord(context.companyId, context.module, (await params).id);
  if (!record || (context.role === "employee" && record.createdBy !== context.userId)) return Response.json({ error: "Data tidak ditemukan." }, { status: 404 });
  return Response.json({ record, permissions: { write: canWriteFeature(context.module, context.role), manage: canManageFeature(context.module, context.role), userId: context.userId } });
}

export async function PATCH(request: Request, { params }: Params) {
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || (!parsed.data.fields && !parsed.data.status)) return Response.json({ error: "Data perubahan tidak valid." }, { status: 400 });
  const context = await featureContext(request, parsed.data.module, "write");
  if ("error" in context) return context.error;
  const record = await scopedFeatureRecord(context.companyId, context.module, (await params).id);
  if (!record) return Response.json({ error: "Data tidak ditemukan." }, { status: 404 });
  if (!canEdit(context.role, context.userId, record.createdBy)) return Response.json({ error: "Tidak dapat mengubah data ini." }, { status: 403 });
  if (context.module.startsWith("pengajuan/") && record.status !== "Menunggu" && !["admin", "owner", "general_manager", "hrd"].includes(context.role)) return Response.json({ error: "Pengajuan yang sudah diproses tidak dapat diubah." }, { status: 409 });
  if (parsed.data.status && parsed.data.status !== record.status) {
    const manage = await featureContext(request, parsed.data.module, "manage");
    if ("error" in manage) return manage.error;
  }
  const fields = parsed.data.fields ? { ...record.fields, ...parsed.data.fields } : record.fields;
  const [updated] = await db.update(featureRecords).set({ fields, status: parsed.data.status ?? record.status, updatedAt: new Date(), updatedBy: context.userId })
    .where(and(eq(featureRecords.id, record.id), eq(featureRecords.companyId, context.companyId))).returning();
  return Response.json({ record: updated });
}

export async function DELETE(request: Request, { params }: Params) {
  const featureName = new URL(request.url).searchParams.get("module") ?? "";
  const context = await featureContext(request, featureName, "manage");
  if ("error" in context) return context.error;
  const record = await scopedFeatureRecord(context.companyId, context.module, (await params).id);
  if (!record) return Response.json({ error: "Data tidak ditemukan." }, { status: 404 });
  await db.delete(featureRecords).where(and(eq(featureRecords.id, record.id), eq(featureRecords.companyId, context.companyId)));
  return Response.json({ ok: true });
}

function canEdit(role: string, userId: string, createdBy: string) { return role === "admin" || role === "owner" || role === "general_manager" || role === "hrd" || createdBy === userId; }
