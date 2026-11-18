import { asc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { jobPositions } from "@/db/schema";
import { featureContext } from "@/features/generic-modules/server/feature-records";

const inputSchema = z.object({ name: z.string().trim().min(2).max(100), active: z.boolean().default(true) });

export async function GET(request: Request) {
  const context = await featureContext(request, "master/jabatan", "read");
  if ("error" in context) return context.error;
  const rows = await db.select().from(jobPositions).where(eq(jobPositions.companyId, context.companyId)).orderBy(asc(jobPositions.name));
  return Response.json({ rows });
}

export async function POST(request: Request) {
  const context = await featureContext(request, "master/jabatan", "write");
  if ("error" in context) return context.error;
  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Nama jabatan wajib diisi minimal 2 karakter." }, { status: 400 });
  try {
    const [row] = await db.insert(jobPositions).values({ companyId: context.companyId, ...parsed.data }).returning();
    revalidatePath("/dashboard/master/jabatan");
    return Response.json({ row: { ...row, employeeCount: 0 } }, { status: 201 });
  } catch {
    return Response.json({ error: "Nama jabatan sudah digunakan." }, { status: 409 });
  }
}
