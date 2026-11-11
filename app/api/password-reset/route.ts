import { NextResponse } from "next/server";
import { z } from "zod";
import { APIError } from "better-auth/api";
import { auth } from "@/lib/auth";

const inputSchema = z.object({ email: z.email() });

export async function POST(request: Request) {
  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ message: "Masukkan email yang valid." }, { status: 400 });
  try {
    await auth.api.requestPasswordReset({ body: { email: parsed.data.email.trim().toLowerCase(), redirectTo: "/atur-password" }, headers: request.headers });
  } catch (error) {
    // Escalating resend limit (applies to every address, so it does not reveal whether an account exists).
    if (error instanceof APIError && error.statusCode === 429) return NextResponse.json({ message: error.body?.message ?? "Terlalu sering. Coba lagi nanti." }, { status: 429 });
    console.error("Permintaan reset password gagal:", error instanceof Error ? error.message : error);
  }
  // Always the same answer so nobody can probe which emails have an account.
  return NextResponse.json({ message: "Jika email terdaftar, tautan untuk mengatur password baru sudah dikirim. Periksa juga folder spam." });
}
