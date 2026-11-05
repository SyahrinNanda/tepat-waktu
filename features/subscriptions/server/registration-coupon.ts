"use server";

import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { subscriptionPlans } from "@/db/schema";
import { DURATION_OPTIONS } from "../plan-rules";
import { evaluateCoupon } from "./coupons";

export type RegistrationCouponPreview = { status: "valid" | "invalid"; message: string; discount?: number; total?: number; code?: string };

/**
 * Coupon check on the public registration page, before any company exists. It only previews the
 * discount; the coupon is checked again (and its quota locked) when the workspace is created.
 */
export async function previewRegistrationCoupon(input: { planCode: string; durationMonths: number; code: string }): Promise<RegistrationCouponPreview> {
  const parsed = z.object({
    planCode: z.string().trim().min(1).max(60),
    durationMonths: z.number().int().refine((value) => (DURATION_OPTIONS as readonly number[]).includes(value)),
    code: z.string().trim().min(1).max(40),
  }).safeParse(input);
  if (!parsed.success) return { status: "invalid", message: "Pilih paket, durasi, dan masukkan kode kupon." };

  const [plan] = await db.select({ code: subscriptionPlans.code, monthlyPrice: subscriptionPlans.monthlyPrice }).from(subscriptionPlans)
    .where(and(eq(subscriptionPlans.code, parsed.data.planCode), eq(subscriptionPlans.active, true), isNull(subscriptionPlans.companyId))).limit(1);
  if (!plan) return { status: "invalid", message: "Paket tidak tersedia." };

  const subtotal = plan.monthlyPrice * parsed.data.durationMonths;
  const result = await evaluateCoupon({ code: parsed.data.code, companyId: null, planCode: plan.code, durationMonths: parsed.data.durationMonths, subtotal });
  if (!result.ok) return { status: "invalid", message: result.message };
  return { status: "valid", message: `Kupon ${result.code} (${result.label}) dipakai.`, discount: result.discount, total: subtotal - result.discount, code: result.code };
}
