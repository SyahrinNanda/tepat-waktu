import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { companies } from "@/db/schema";
import { SELECTED_COMPANY_COOKIE } from "@/lib/selected-company";
import { requireSuperAdmin } from "@/lib/superadmin";
import { recordAudit } from "@/lib/audit";

/** Superadmin opens a tenant's dashboard as its admin. */
export async function enterCompanyAsSuperAdmin(companyId: string) {
  const session = await requireSuperAdmin();
  const [company] = await db.select({ id: companies.id, name: companies.name }).from(companies).where(eq(companies.id, companyId)).limit(1);
  if (!company) throw new Error("Perusahaan tidak ditemukan.");
  await recordAudit(session, { action: "company.enter", companyId: company.id, summary: `Masuk ke dashboard ${company.name} sebagai admin` });
  const store = await cookies();
  store.set(SELECTED_COMPANY_COOKIE, company.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.BETTER_AUTH_URL?.startsWith("https://") ?? false,
    path: "/",
    maxAge: 60 * 60 * 8,
  });
  redirect("/dashboard");
}
