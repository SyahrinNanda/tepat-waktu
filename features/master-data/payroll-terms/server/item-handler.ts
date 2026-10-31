import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { payrollTerms } from "@/db/schema";
import { featureContext } from "@/features/generic-modules/server/feature-records";

type Params = { params: Promise<{ id: string }> };
const inputSchema = z.object({ name: z.string().trim().min(2).max(100), type: z.enum(["compensation", "deduction"]), active: z.boolean() });

export async function PATCH(request: Request, { params }: Params) {
  const context = await featureContext(request, "master/istilah-gaji", "write");
  if ("error" in context) return context.error;
  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Data istilah gaji tidak valid." }, { status: 400 });
  try {
    const [row] = await db.update(payrollTerms).set({ ...parsed.data, updatedAt: new Date() }).where(and(eq(payrollTerms.id, (await params).id), eq(payrollTerms.companyId, context.companyId))).returning();
    if (!row) return Response.json({ error: "Istilah gaji tidak ditemukan." }, { status: 404 });
    revalidatePath("/dashboard/master/istilah-gaji");
    revalidatePath("/dashboard/payroll/istilah");
    return Response.json({ row });
  } catch {
    return Response.json({ error: "Nama istilah sudah digunakan." }, { status: 409 });
  }
}

export async function DELETE(request: Request, { params }: Params) {
  const context = await featureContext(request, "master/istilah-gaji", "manage");
  if ("error" in context) return context.error;
  const [row] = await db.delete(payrollTerms).where(and(eq(payrollTerms.id, (await params).id), eq(payrollTerms.companyId, context.companyId))).returning({ id: payrollTerms.id });
  if (!row) return Response.json({ error: "Istilah gaji tidak ditemukan." }, { status: 404 });
  revalidatePath("/dashboard/master/istilah-gaji");
  return Response.json({ ok: true });
}
