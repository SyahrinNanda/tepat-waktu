import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { RECOVERY_COOKIE, validRecoveryProof } from "@/lib/supabase/recovery";
import { supabaseServer, supabaseServerConfigured } from "@/lib/supabase/server";

const schema = z.object({ password: z.string().min(8).max(128) });

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ message: "Password minimal 8 karakter." }, { status: 400 });
  if (!supabaseServerConfigured()) return NextResponse.json({ message: "Layanan pemulihan belum dikonfigurasi." }, { status: 503 });
  const client = await supabaseServer();
  const { data: { user } } = await client.auth.getUser();
  const proof = (await cookies()).get(RECOVERY_COOKIE)?.value;
  if (!user || !validRecoveryProof(proof, user.id)) return NextResponse.json({ message: "Tautan pemulihan tidak berlaku atau kedaluwarsa." }, { status: 401 });
  const result = await client.auth.updateUser({ password: parsed.data.password });
  if (result.error) return NextResponse.json({ message: result.error.message }, { status: 502 });
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(RECOVERY_COOKIE);
  return response;
}
