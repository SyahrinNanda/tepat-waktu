import { NextResponse } from "next/server";
import { z } from "zod";

const inputSchema = z.object({ email: z.email() });

export async function POST(request: Request) {
  const parsed = inputSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ message: "Masukkan email yang valid." }, { status: 400 });
  // Respons sengaja selalu sama agar alamat akun tidak dapat ditebak.
  return NextResponse.json({ message: "Jika email terdaftar, instruksi pemulihan akan dikirim." });
}
