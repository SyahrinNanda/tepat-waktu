import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { featureRecords } from "@/db/schema";
import { featureContext } from "@/features/generic-modules/server/feature-records";
import { canManageFeature, canWriteFeature } from "@/features/generic-modules/config/feature-modules";

const schema = z.object({
  module: z.string(),
  fields: z.record(z.string().min(1).max(100), z.string().trim().max(1000)).refine((value) => Object.keys(value).length > 0 && Object.keys(value).length <= 30),
  status: z.string().trim().max(40).optional(),
});

export async function GET(request: Request) {
  const featureName = new URL(request.url).searchParams.get("module") ?? "";
  const context = await featureContext(request, featureName, "read");
  if ("error" in context) return context.error;
  const rows = await db.select().from(featureRecords).where(and(eq(featureRecords.companyId, context.companyId), eq(featureRecords.module, context.module), context.role === "employee" ? eq(featureRecords.createdBy, context.userId) : undefined)).orderBy(desc(featureRecords.createdAt)).limit(500);
  return Response.json({ rows, permissions: { write: canWriteFeature(context.module, context.role), manage: canManageFeature(context.module, context.role), userId: context.userId } });
}

export async function POST(request: Request) {
  const body = schema.safeParse(await request.json().catch(() => null));
  if (!body.success) return Response.json({ error: "Data form tidak valid.", details: body.error.flatten() }, { status: 400 });
  const context = await featureContext(request, body.data.module, "write");
  if ("error" in context) return context.error;
  const fields = { ...body.data.fields };
  if (context.role === "employee" && context.module.startsWith("pengajuan/")) fields["Nama Karyawan"] = context.userName;
  const [record] = await db.insert(featureRecords).values({ companyId: context.companyId, module: context.module, fields, status: context.module.startsWith("pengajuan/") ? "Menunggu" : body.data.status || "Aktif", createdBy: context.userId }).returning();
  return Response.json({ record }, { status: 201 });
}
