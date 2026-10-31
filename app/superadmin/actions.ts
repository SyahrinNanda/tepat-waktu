"use server";

import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { companies } from "@/db/schema";
import { SELECTED_COMPANY_COOKIE } from "@/lib/selected-company";
import { requireSuperAdmin } from "@/lib/superadmin";

export async function enterCompany(form: FormData) {
  await requireSuperAdmin();
  const companyId = z.uuid().parse(form.get("companyId"));
  const [company] = await db.select({ id: companies.id }).from(companies).where(eq(companies.id, companyId)).limit(1);
  if (!company) throw new Error("Perusahaan tidak ditemukan.");
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

export async function leaveCompany() {
  await requireSuperAdmin();
  const store = await cookies();
  store.delete(SELECTED_COMPANY_COOKIE);
  redirect("/superadmin");
}
