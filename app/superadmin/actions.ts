"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { SELECTED_COMPANY_COOKIE } from "@/lib/selected-company";
import { requireSuperAdmin } from "@/lib/superadmin";
import { enterCompanyAsSuperAdmin } from "@/lib/enter-company";

export async function enterCompany(form: FormData) {
  await enterCompanyAsSuperAdmin(z.uuid().parse(form.get("companyId")));
}

export async function leaveCompany() {
  await requireSuperAdmin();
  const store = await cookies();
  store.delete(SELECTED_COMPANY_COOKIE);
  redirect("/superadmin");
}
