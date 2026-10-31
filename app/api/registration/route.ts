import { eq, and } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { companies, companyMembers, subscriptionOrders, subscriptionPlans, user } from "@/db/schema";
import { emailDeliveryConfigured, EmailDeliveryError } from "@/lib/verification-email";
import { markEmailSent } from "@/lib/email-send-cooldown";

const schema = z.object({
  industry: z.enum(["Teknologi", "Pemerintahan", "F&B", "Jasa", "Media", "Lainnya"]),
  plan: z.string().trim().min(1),
  companyName: z.string().trim().min(2).max(120),
  name: z.string().trim().min(2).max(120),
  email: z.email().transform((value) => value.trim().toLowerCase()),
  password: z.string().min(8).max(128),
});

export async function POST(request: Request) {
  if (!emailDeliveryConfigured()) return NextResponse.json({ message: "Pengiriman email belum dikonfigurasi. Hubungi administrator untuk mengisi RESEND_API_KEY dan EMAIL_FROM." }, { status: 503 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ message: "Periksa kembali data pendaftaran." }, { status: 400 });
  const input = parsed.data;
  const [plan] = await db.select().from(subscriptionPlans).where(and(eq(subscriptionPlans.code, input.plan), eq(subscriptionPlans.active, true))).limit(1);
  if (!plan) return NextResponse.json({ message: "Paket tidak tersedia. Pilih paket lain." }, { status: 400 });
  const [freePlan] = await db.select().from(subscriptionPlans).where(and(eq(subscriptionPlans.monthlyPrice, 0), eq(subscriptionPlans.active, true))).limit(1);
  if (plan.monthlyPrice > 0 && !freePlan) return NextResponse.json({ message: "Paket dasar belum tersedia. Hubungi administrator." }, { status: 503 });
  const [existing] = await db.select({ id: user.id }).from(user).where(eq(user.email, input.email)).limit(1);
  if (existing) return NextResponse.json({ message: "Email sudah terdaftar. Silakan masuk atau gunakan email lain." }, { status: 409 });

  try {
    const result = await auth.api.signUpEmail({ body: { name: input.name, email: input.email, password: input.password, callbackURL: "/verifikasi-email/berhasil" } });
    if (!result.user?.id) throw new Error("Akun tidak berhasil dibuat.");
    try {
      await db.transaction(async (tx) => {
        const [company] = await tx.insert(companies).values({ name: input.companyName, email: input.email, industry: input.industry, plan: plan.monthlyPrice === 0 ? plan.code : freePlan!.code }).returning({ id: companies.id });
        await tx.insert(companyMembers).values({ companyId: company.id, userId: result.user.id, role: "admin" });
        const now = new Date();
        const isFree = plan.monthlyPrice === 0;
        const durationMonths = isFree ? Math.max(plan.trialMonths, 1) : 1;
        const endsAt = isFree ? new Date(now) : null;
        if (endsAt) endsAt.setMonth(endsAt.getMonth() + durationMonths);
        if (!isFree && freePlan) {
          const freeEndsAt = new Date(now);
          const freeDuration = Math.max(freePlan.trialMonths, 1);
          freeEndsAt.setMonth(freeEndsAt.getMonth() + freeDuration);
          await tx.insert(subscriptionOrders).values({ companyId: company.id, planId: freePlan.id, invoiceNumber: `REG-${now.toISOString().slice(0, 10).replaceAll("-", "")}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`, transactionType: "new", durationMonths: freeDuration, subtotal: 0, amount: 0, status: "active", startedAt: now, endsAt: freeEndsAt, requestedBy: result.user.id });
        }
        await tx.insert(subscriptionOrders).values({ companyId: company.id, planId: plan.id, invoiceNumber: `REG-${now.toISOString().slice(0, 10).replaceAll("-", "")}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`, transactionType: "new", durationMonths, subtotal: plan.monthlyPrice * durationMonths, amount: plan.monthlyPrice * durationMonths, status: isFree ? "active" : "pending", startedAt: isFree ? now : null, endsAt, requestedBy: result.user.id });
      });
    } catch (error) {
      await db.delete(user).where(eq(user.id, result.user.id));
      throw error;
    }
    try {
      await auth.api.sendVerificationEmail({ body: { email: input.email, callbackURL: `/verifikasi-email/berhasil?email=${encodeURIComponent(input.email)}` } });
      await markEmailSent(input.email).catch((error) => console.error("Jeda kirim ulang email gagal disimpan:", error));
    } catch (error) {
      console.error("Email verifikasi gagal dikirim:", error);
      return NextResponse.json({ ok: true, email: input.email, emailSent: false, emailError: error instanceof EmailDeliveryError ? error.message : "Layanan email sedang tidak tersedia. Silakan coba lagi." }, { status: 202 });
    }
    return NextResponse.json({ ok: true, email: input.email }, { status: 201 });
  } catch (error) {
    console.error("Pendaftaran gagal:", error);
    return NextResponse.json({ message: "Pendaftaran belum berhasil. Periksa data atau coba lagi beberapa saat." }, { status: 500 });
  }
}
