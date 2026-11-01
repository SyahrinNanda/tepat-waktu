import { and, eq } from "drizzle-orm";
import { getAppSession } from "@/lib/app-session";
import { db } from "@/db";
import { companies, companyMembers, featureRecords, user } from "@/db/schema";
import { canManageFeature, canReadFeature, canWriteFeature, isFeatureModule } from "@/features/generic-modules/config/feature-modules";
import { selectedCompanyFromRequest } from "@/lib/selected-company";

export async function featureContext(request: Request, module: string, operation: "read" | "write" | "manage") {
  if (!isFeatureModule(module)) return { error: Response.json({ error: "Fitur tidak ditemukan." }, { status: 404 }) } as const;
  const session = await getAppSession(request.headers);
  if (!session) return { error: Response.json({ error: "Silakan masuk kembali." }, { status: 401 }) } as const;
  const [account] = await db.select({ platformRole: user.platformRole }).from(user).where(eq(user.id, session.user.id)).limit(1);
  if (account?.platformRole === "superadmin") {
    const companyId = selectedCompanyFromRequest(request);
    if (!companyId) return { error: Response.json({ error: "Pilih perusahaan terlebih dahulu." }, { status: 409 }) } as const;
    const [company] = await db.select({ id: companies.id }).from(companies).where(eq(companies.id, companyId)).limit(1);
    if (!company) return { error: Response.json({ error: "Perusahaan tidak ditemukan." }, { status: 404 }) } as const;
    return { module, companyId: company.id, role: "admin" as const, userId: session.user.id, userName: session.user.name, isSuperAdmin: true } as const;
  }
  const [membership] = await db.select({ companyId: companyMembers.companyId, role: companyMembers.role }).from(companyMembers).where(eq(companyMembers.userId, session.user.id)).limit(1);
  if (!membership) return { error: Response.json({ error: "Perusahaan tidak ditemukan." }, { status: 403 }) } as const;
  const allowed = operation === "read" ? canReadFeature(module, membership.role) : operation === "write" ? canWriteFeature(module, membership.role) : canManageFeature(module, membership.role);
  if (!allowed) return { error: Response.json({ error: "Tidak memiliki akses ke fitur ini." }, { status: 403 }) } as const;
  return { module, companyId: membership.companyId, role: membership.role, userId: session.user.id, userName: session.user.name, isSuperAdmin: false } as const;
}

export async function scopedFeatureRecord(companyId: string, module: string, id: string) {
  const [record] = await db.select().from(featureRecords).where(and(eq(featureRecords.id, id), eq(featureRecords.companyId, companyId), eq(featureRecords.module, module))).limit(1);
  return record;
}
