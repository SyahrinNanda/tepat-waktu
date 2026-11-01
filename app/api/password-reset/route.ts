import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";

const inputSchema = z.object({ email: z.email() });

export async function POST(request: Request) {
  const parsed = inputSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ message: "Masukkan email yang valid." }, { status: 400 });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return NextResponse.json({ message: "Layanan pemulihan akun belum dikonfigurasi." }, { status: 503 });
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
  const { error } = await client.auth.resetPasswordForEmail(parsed.data.email, { redirectTo: `${appUrl}/auth/callback` });
  if (error) console.error("Permintaan pemulihan Supabase gagal:", error.code ?? error.name);
  // Respons sengaja selalu sama agar alamat akun tidak dapat ditebak.
  return NextResponse.json({ message: "Jika email terdaftar, instruksi pemulihan akan dikirim." });
}
