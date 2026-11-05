import type { Metadata } from "next";
import { RegistrationFlow } from "@/components/registration-flow";
import { db } from "@/db";
import { subscriptionPlans } from "@/db/schema";
import { and, asc, eq, isNull } from "drizzle-orm";
import { connection } from "next/server";

export const metadata: Metadata = { title: "Daftar" };

export default async function RegisterPage() {
  await connection();
  const plans = await db.select({ code: subscriptionPlans.code, name: subscriptionPlans.name, monthlyPrice: subscriptionPlans.monthlyPrice, maxEmployees: subscriptionPlans.maxEmployees, description: subscriptionPlans.description, trialMonths: subscriptionPlans.trialMonths, trialDays: subscriptionPlans.trialDays, recommended: subscriptionPlans.recommended }).from(subscriptionPlans).where(and(eq(subscriptionPlans.active, true), isNull(subscriptionPlans.companyId))).orderBy(asc(subscriptionPlans.monthlyPrice), asc(subscriptionPlans.maxEmployees));
  return <RegistrationFlow plans={plans}/>;
}
