import { and, eq, isNull } from "drizzle-orm";
import { APIError } from "better-auth/api";
import { z } from "zod";
import { db } from "@/db";
import { companyMembers, subscriptionPlans, user } from "@/db/schema";
import { auth } from "@/lib/auth";
import { REGISTRATION_INDUSTRIES, saveRegistrationRequest } from "./provision";

export const VERIFIED_CALLBACK = "/verifikasi-email/berhasil";

const schema = z.object({
  companyName: z.string().trim().min(2).max(120),
  name: z.string().trim().min(2).max(120),
  email: z.email().transform((value) => value.trim().toLowerCase()),
  password: z.string().min(8).max(128),
  industry: z.enum(REGISTRATION_INDUSTRIES),
  plan: z.string().trim().min(1).max(60),
  durationMonths: z.number().int().min(1).max(12).optional(),
  couponCode: z.string().trim().max(40).optional(),
});

type Result = { status: number; body: Record<string, unknown> };
const fail = (status: number, message: string): Result => ({ status, body: { message } });

/**
 * Public sign-up. The account stays unverified (cannot log in) until the emailed link is opened;
 * the company itself is created after verification from the stored form (provisionRegistration).
 */
export async function handleRegistration(input: unknown, headers: Headers): Promise<Result> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return fail(400, "Periksa kembali data perusahaan, akun, dan paket.");
  const data = parsed.data;

  const [plan] = await db.select({ code: subscriptionPlans.code }).from(subscriptionPlans)
    .where(and(eq(subscriptionPlans.code, data.plan), eq(subscriptionPlans.active, true), isNull(subscriptionPlans.companyId))).limit(1);
  if (!plan) return fail(400, "Paket tidak tersedia. Pilih paket lain.");

  const [existing] = await db.select({ id: user.id, emailVerified: user.emailVerified }).from(user).where(eq(user.email, data.email)).limit(1);
  if (existing) {
    const [membership] = await db.select({ id: companyMembers.id }).from(companyMembers).where(eq(companyMembers.userId, existing.id)).limit(1);
    if (existing.emailVerified || membership) return fail(409, "Email sudah terdaftar. Silakan masuk atau gunakan email lain.");
    // An earlier sign-up that was never verified: start over with the new form and password.
    await db.delete(user).where(eq(user.id, existing.id));
  }

  let userId: string;
  try {
    const created = await auth.api.signUpEmail({ body: { name: data.name, email: data.email, password: data.password }, headers });
    userId = created.user.id;
  } catch (error) {
    if (error instanceof APIError) return fail(error.statusCode === 429 ? 429 : 400, error.statusCode === 429 ? "Terlalu banyak percobaan. Coba lagi beberapa saat lagi." : error.body?.message ?? "Akun belum dapat dibuat.");
    console.error("Pendaftaran gagal:", error);
    return fail(500, "Akun belum dapat dibuat. Silakan coba lagi.");
  }

  try {
    await saveRegistrationRequest(userId, { companyName: data.companyName, industry: data.industry, planCode: plan.code, durationMonths: data.durationMonths, couponCode: data.couponCode });
  } catch (error) {
    console.error("Data pendaftaran gagal disimpan:", error);
    await db.delete(user).where(eq(user.id, userId));
    return fail(500, "Akun belum dapat dibuat. Silakan coba lagi.");
  }

  await auth.api.sendVerificationEmail({ body: { email: data.email, callbackURL: VERIFIED_CALLBACK }, headers });
  return { status: 201, body: { ok: true, email: data.email } };
}
