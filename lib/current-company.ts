import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getAppSession } from "@/lib/app-session";
import { db } from "@/db";
import { companies, companyMembers, user } from "@/db/schema";
import { SELECTED_COMPANY_COOKIE } from "@/lib/selected-company";

export type CompanyRole = "owner" | "admin" | "general_manager" | "hrd" | "manager" | "employee";

export async function requireCompany() {
  const session = await getAppSession();
  if (!session) redirect("/");

  const [account] = await db.select({ platformRole: user.platformRole }).from(user).where(eq(user.id, session.user.id)).limit(1);
  if (account?.platformRole === "superadmin") {
    const companyId = (await cookies()).get(SELECTED_COMPANY_COOKIE)?.value;
    if (!companyId) redirect("/superadmin");
    const [company] = await db.select({ companyId: companies.id, companyName: companies.name, industry: companies.industry, plan: companies.plan, timezone: companies.timezone }).from(companies).where(eq(companies.id, companyId)).limit(1);
    if (!company) redirect("/superadmin");
    return { session, ...company, role: "admin" as const, isSuperAdmin: true };
  }

  const [membership] = await db
    .select({ companyId: companies.id, companyName: companies.name, industry: companies.industry, plan: companies.plan, timezone: companies.timezone, role: companyMembers.role })
    .from(companyMembers)
    .innerJoin(companies, eq(companyMembers.companyId, companies.id))
    .where(eq(companyMembers.userId, session.user.id))
    .limit(1);

  if (!membership) redirect("/register");
  return { session, ...membership, isSuperAdmin: false };
}

export async function requireCompanyRole(allowedRoles: CompanyRole[]) {
  const context = await requireCompany();
  const role = context.role === "owner" ? "admin" : context.role;
  const normalizedAllowed = allowedRoles.map((value) => value === "owner" ? "admin" : value);
  if (!normalizedAllowed.includes(role)) {
    redirect("/dashboard");
  }
  return { ...context, role };
}

export function dateInTimeZone(timeZone: string, value = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}

export function todayInMakassar() {
  return dateInTimeZone("Asia/Makassar");
}
