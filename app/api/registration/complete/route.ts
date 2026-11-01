import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer, supabaseServerConfigured } from "@/lib/supabase/server";
import { provisionSupabaseRegistration } from "@/lib/supabase/provision";

const schema = z.object({
  companyName: z.string().trim().min(2).max(120),
  name: z.string().trim().min(2).max(120),
  industry: z.enum(["Teknologi", "Pemerintahan", "F&B", "Jasa", "Media", "Lainnya"]),
  plan: z.string().trim().min(1),
});

export async function POST(request: Request) {
  if (!supabaseServerConfigured()) return NextResponse.json({ message: "Supabase Auth belum dikonfigurasi." }, { status: 503 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ message: "Periksa data perusahaan dan paket." }, { status: 400 });
  const client = await supabaseServer();
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user?.email_confirmed_at) return NextResponse.json({ message: "Masuk dengan Google terlebih dahulu." }, { status: 401 });
  const updated = await client.auth.updateUser({ data: parsed.data });
  if (updated.error || !updated.data.user) return NextResponse.json({ message: "Data pendaftaran belum dapat disimpan." }, { status: 502 });
  try {
    const result = await provisionSupabaseRegistration(updated.data.user);
    if (result.needsCompany) return NextResponse.json({ message: "Paket belum tersedia. Pilih paket lain." }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Pendaftaran Google gagal:", error);
    return NextResponse.json({ message: "Ruang kerja belum dapat dibuat. Silakan coba lagi." }, { status: 500 });
  }
}
