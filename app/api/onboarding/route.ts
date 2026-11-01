import { NextResponse } from "next/server";
import { z } from "zod";
import { getAppSession } from "@/lib/app-session";
import { db } from "@/db";
import { companies, companyMembers } from "@/db/schema";

const inputSchema = z.object({
  companyName: z.string().trim().min(2).max(120),
  industry: z.string().trim().min(2).max(60),
  plan: z.enum(["starter", "growth"]),
});

export async function POST(request: Request) {
  const session = await getAppSession();
  if (!session) return NextResponse.json({ message: "Sesi tidak ditemukan." }, { status: 401 });
  const parsed = inputSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ message: "Data perusahaan belum lengkap." }, { status: 400 });

  const [company] = await db.insert(companies).values({
    name: parsed.data.companyName,
    industry: parsed.data.industry,
    plan: parsed.data.plan,
  }).returning({ id: companies.id });
  // Registration grants administration rights only for the newly created
  // company. Global superadmin access is provisioned separately.
  await db.insert(companyMembers).values({ companyId: company.id, userId: session.user.id, role: "admin" });
  return NextResponse.json({ ok: true, companyId: company.id }, { status: 201 });
}
