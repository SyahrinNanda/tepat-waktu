import { asc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { divisions } from "@/db/schema";
import { featureContext } from "@/features/generic-modules/server/feature-records";

const inputSchema = z.object({ name: z.string().trim().min(2).max(100), active: z.boolean().default(true) });

export async function GET(request: Request) {
  const context = await featureContext(request, "master/divisi", "read");
  if ("error" in context) return context.error;
  const rows = await db.select().from(divisions).where(eq(divisions.companyId, context.companyId)).orderBy(asc(divisions.name));
  return Response.json({ rows });
}

export async function POST(request: Request) {
  const context = await featureContext(request, "master/divisi", "write");
  if ("error" in context) return context.error;
  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Nama divisi wajib diisi minimal 2 karakter." }, { status: 400 });
  try {
    const [row] = await db.insert(divisions).values({ companyId: context.companyId, ...parsed.data }).returning();
    revalidatePath("/dashboard/master/divisi");
    return Response.json({ row: { ...row, employeeCount: 0 } }, { status: 201 });
  } catch {
    return Response.json({ error: "Nama divisi sudah digunakan." }, { status: 409 });
  }
}
