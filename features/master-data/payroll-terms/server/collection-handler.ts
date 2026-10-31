import { asc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { payrollTerms } from "@/db/schema";
import { featureContext } from "@/features/generic-modules/server/feature-records";

const inputSchema = z.object({ name: z.string().trim().min(2).max(100), type: z.enum(["compensation", "deduction"]), active: z.boolean().default(true) });

export async function GET(request: Request) {
  const context = await featureContext(request, "master/istilah-gaji", "read");
  if ("error" in context) return context.error;
  const rows = await db.select().from(payrollTerms).where(eq(payrollTerms.companyId, context.companyId)).orderBy(asc(payrollTerms.name));
  return Response.json({ rows });
}

export async function POST(request: Request) {
  const context = await featureContext(request, "master/istilah-gaji", "write");
  if ("error" in context) return context.error;
  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Nama dan tipe istilah wajib diisi." }, { status: 400 });
  try {
    const [row] = await db.insert(payrollTerms).values({ companyId: context.companyId, ...parsed.data }).returning();
    revalidatePath("/dashboard/master/istilah-gaji");
    revalidatePath("/dashboard/payroll/istilah");
    return Response.json({ row }, { status: 201 });
  } catch {
    return Response.json({ error: "Nama istilah sudah digunakan." }, { status: 409 });
  }
}
