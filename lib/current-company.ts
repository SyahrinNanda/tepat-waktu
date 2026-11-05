import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getAppSession } from "@/lib/app-session";
import { db } from "@/db";
import { companies, companyMembers, user } from "@/db/schema";
import { SELECTED_COMPANY_COOKIE } from "@/lib/selected-company";
import { getSubscriptionStatus } from "@/features/subscriptions/server/subscription-status";

/** Pages a company admin may still open after the subscription ended, to renew it. */
export const SUBSCRIPTION_RENEW_PATH = "/dashboard/langganan";
export const SUBSCRIPTION_LOCKED_PATH = "/langganan-berakhir";

type CompanyOptions = {
  /** Skip the expired-subscription gate (subscription pages and the dashboard layout only). */
  allowExpired?: boolean;
};

export type CompanyRole = "owner" | "admin" | "general_manager" | "hrd" | "manager" | "employee";

export async function requireCompany(options: CompanyOptions = {}) {
  const session = await getAppSession();
  if (!session) redirect("/");

  const [account] = await db.select({ platformRole: user.platformRole }).from(user).where(eq(user.id, session.user.id)).limit(1);
  if (account?.platformRole === "superadmin") {
    const companyId = (await cookies()).get(SELECTED_COMPANY_COOKIE)?.value;
    if (!companyId) redirect("/superadmin");
    const [company] = await db.select({ companyId: companies.id, companyName: companies.name, industry: companies.industry, plan: companies.plan, timezone: companies.timezone }).from(companies).where(eq(companies.id, companyId)).limit(1);
    if (!company) redirect("/superadmin");
    // Superadmin can always enter a tenant (e.g. to help it renew), but sees its status.
    const subscription = await getSubscriptionStatus(company.companyId);
    return { session, ...company, role: "admin" as const, isSuperAdmin: true, subscription };
  }

  const [membership] = await db
    .select({ companyId: companies.id, companyName: companies.name, industry: companies.industry, plan: companies.plan, timezone: companies.timezone, role: companyMembers.role })
    .from(companyMembers)
    .innerJoin(companies, eq(companyMembers.companyId, companies.id))
    .where(eq(companyMembers.userId, session.user.id))
    .limit(1);

  if (!membership) redirect("/register");
  const subscription = await getSubscriptionStatus(membership.companyId);
  if (subscription.state === "expired" && !options.allowExpired) {
    redirect(membership.role === "admin" || membership.role === "owner" ? `${SUBSCRIPTION_RENEW_PATH}?expired=1` : SUBSCRIPTION_LOCKED_PATH);
  }
  return { session, ...membership, isSuperAdmin: false, subscription };
}

export async function requireCompanyRole(allowedRoles: CompanyRole[], options: CompanyOptions = {}) {
  const context = await requireCompany(options);
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
