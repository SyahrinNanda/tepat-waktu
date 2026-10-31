import type { Metadata } from "next";
import { and, count, eq } from "drizzle-orm";
import { db } from "@/db";
import { companies, employees, subscriptionPlans, user } from "@/db/schema";
import { ProfileSettings } from "@/components/profile-settings";
import { requireCompany } from "@/lib/current-company";

export const metadata: Metadata = { title: "Profile" };

export default async function Page() {
  const context = await requireCompany();
  const [[account], [company], [employeeUsage]] = await Promise.all([
    db.select({
      name: user.name,
      email: user.email,
      timezone: user.timezone,
    }).from(user).where(eq(user.id, context.session.user.id)).limit(1),
    db.select({
      name: companies.name,
      email: companies.email,
      industry: companies.industry,
      province: companies.province,
      city: companies.city,
      district: companies.district,
      address: companies.address,
      phone: companies.phone,
      whatsapp: companies.whatsapp,
      planName: subscriptionPlans.name,
      maxEmployees: subscriptionPlans.maxEmployees,
    })
      .from(companies)
      .leftJoin(subscriptionPlans, eq(companies.plan, subscriptionPlans.code))
      .where(eq(companies.id, context.companyId))
      .limit(1),
    db.select({ value: count() })
      .from(employees)
      .where(and(eq(employees.companyId, context.companyId), eq(employees.status, "active"))),
  ]);

  if (!account || !company) return null;
  const maxEmployees = company.maxEmployees ?? Math.max(employeeUsage.value, 5);

  return (
    <ProfileSettings
      user={{ ...account, role: context.role }}
      company={{
        ...company,
        email: company.email ?? account.email,
        planName: company.planName ?? context.plan,
        employeeCount: employeeUsage.value,
        maxEmployees,
      }}
      canManageCompany={context.role === "admin" || context.role === "owner" || context.isSuperAdmin}
    />
  );
}
