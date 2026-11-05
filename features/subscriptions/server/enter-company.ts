"use server";

import { z } from "zod";
import { enterCompanyAsSuperAdmin } from "@/lib/enter-company";

export async function enterCompanyAction(form: FormData) {
  await enterCompanyAsSuperAdmin(z.uuid().parse(form.get("companyId")));
}
