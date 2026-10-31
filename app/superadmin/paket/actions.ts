"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { subscriptionOrders, subscriptionPlans } from "@/db/schema";
import { requireSuperAdmin } from "@/lib/superadmin";

export async function createPlan(formData: FormData) {
  await requireSuperAdmin();

  const codeRaw = String(formData.get("code") || "").trim().toLowerCase().replace(/[^a-z0-9_-]/g, "-");
  const name = String(formData.get("name") || "").trim();
  const monthlyPrice = Math.max(0, parseInt(String(formData.get("monthlyPrice") || "0"), 10));
  const maxEmployees = Math.max(1, parseInt(String(formData.get("maxEmployees") || "5"), 10));
  const description = String(formData.get("description") || "").trim() || `Akses fitur untuk maksimal ${maxEmployees} karyawan.`;
  const active = formData.get("active") === "true";

  if (!codeRaw || !name) {
    throw new Error("Kode dan nama paket wajib diisi.");
  }

  const [existing] = await db
    .select({ id: subscriptionPlans.id })
    .from(subscriptionPlans)
    .where(eq(subscriptionPlans.code, codeRaw))
    .limit(1);

  if (existing) {
    throw new Error(`Paket dengan kode '${codeRaw}' sudah ada.`);
  }

  await db.insert(subscriptionPlans).values({
    code: codeRaw,
    name,
    monthlyPrice,
    maxEmployees,
    description,
    active,
  });

  revalidatePath("/superadmin/paket");
  revalidatePath("/dashboard/langganan/paket");
}

export async function updatePlan(formData: FormData) {
  await requireSuperAdmin();

  const id = z.string().uuid().parse(formData.get("id"));
  const name = z.string().trim().min(2).max(100).parse(formData.get("name"));
  const monthlyPrice = z.coerce.number().int().min(0).parse(formData.get("monthlyPrice"));
  const maxEmployees = z.coerce.number().int().min(1).parse(formData.get("maxEmployees"));
  const description = z.string().trim().max(500).parse(formData.get("description"));
  const active = formData.get("active") === "true";

  await db
    .update(subscriptionPlans)
    .set({
      name,
      monthlyPrice,
      maxEmployees,
      description,
      active,
    })
    .where(eq(subscriptionPlans.id, id));

  revalidatePath("/superadmin/paket");
  revalidatePath("/dashboard/langganan/paket");
}

export async function deletePlan(formData: FormData) {
  await requireSuperAdmin();

  const id = z.string().uuid().parse(formData.get("id"));

  const [hasOrders] = await db
    .select({ id: subscriptionOrders.id })
    .from(subscriptionOrders)
    .where(eq(subscriptionOrders.planId, id))
    .limit(1);

  if (hasOrders) {
    // If referenced in orders, deactivate instead of foreign key violation
    await db.update(subscriptionPlans).set({ active: false }).where(eq(subscriptionPlans.id, id));
  } else {
    await db.delete(subscriptionPlans).where(eq(subscriptionPlans.id, id));
  }

  revalidatePath("/superadmin/paket");
  revalidatePath("/dashboard/langganan/paket");
}
