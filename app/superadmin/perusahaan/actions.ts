"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { companies, subscriptionPlans } from "@/db/schema";
import { requireSuperAdmin } from "@/lib/superadmin";

export async function setCompanyPlan(form: FormData) {
  await requireSuperAdmin();
  const data = z.object({ companyId: z.uuid(), planId: z.uuid() }).parse(Object.fromEntries(form));
  const [plan] = await db.select({ code: subscriptionPlans.code }).from(subscriptionPlans).where(eq(subscriptionPlans.id, data.planId)).limit(1);
  if (!plan) throw new Error("Paket tidak ditemukan.");
  const updated = await db.update(companies).set({ plan: plan.code }).where(eq(companies.id, data.companyId)).returning({ id: companies.id });
  if (!updated.length) throw new Error("Perusahaan tidak ditemukan.");
  revalidatePath(`/superadmin/perusahaan/${data.companyId}`);
  revalidatePath("/superadmin/perusahaan");
  revalidatePath("/superadmin");
  revalidatePath("/dashboard");
}
