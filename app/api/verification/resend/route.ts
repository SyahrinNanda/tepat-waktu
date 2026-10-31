import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { emailDeliveryConfigured, EmailDeliveryError } from "@/lib/verification-email";
import { EMAIL_RESEND_COOLDOWN_SECONDS, releaseEmailResend, reserveEmailResend } from "@/lib/email-send-cooldown";

const bodySchema = z.object({ email: z.email().transform((value) => value.trim().toLowerCase()) });

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ message: "Masukkan alamat email yang valid." }, { status: 400 });
  if (!emailDeliveryConfigured()) return NextResponse.json({ message: "Email belum dikonfigurasi. Administrator perlu mengisi RESEND_API_KEY dan EMAIL_FROM yang valid." }, { status: 503 });

  const email = parsed.data.email;
  const reservation = await reserveEmailResend(email);
  if (!reservation.allowed) return NextResponse.json(
    { message: "Tunggu sebelum mengirim ulang email verifikasi.", retryAfter: reservation.retryAfter },
    { status: 429, headers: { "Retry-After": String(reservation.retryAfter) } },
  );

  try {
    await auth.api.sendVerificationEmail({ body: { email, callbackURL: `/verifikasi-email/berhasil?email=${encodeURIComponent(email)}` } });
    return NextResponse.json({ message: "Jika akun belum terverifikasi, tautan baru telah dikirim.", retryAfter: EMAIL_RESEND_COOLDOWN_SECONDS });
  } catch (error) {
    await releaseEmailResend(email, reservation.nextAllowedAt).catch((releaseError) => console.error("Gagal melepas jeda pengiriman email:", releaseError));
    const known = error instanceof EmailDeliveryError ? error : null;
    console.error("Pengiriman ulang email gagal:", known?.reason ?? (error instanceof Error ? error.name : "unknown"));
    return NextResponse.json({ message: known?.message ?? "Email belum dapat dikirim. Silakan coba lagi." }, { status: known?.reason === "rate_limit" ? 429 : 502 });
  }
}
