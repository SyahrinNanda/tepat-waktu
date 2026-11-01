import { NextRequest, NextResponse } from "next/server";
import { supabaseServer, supabaseServerConfigured } from "@/lib/supabase/server";
import { provisionSupabaseRegistration } from "@/lib/supabase/provision";
import { createRecoveryProof, RECOVERY_COOKIE } from "@/lib/supabase/recovery";

export async function GET(request: NextRequest) {
  const origin = new URL(process.env.NEXT_PUBLIC_APP_URL || request.url).origin;
  if (!supabaseServerConfigured()) return NextResponse.redirect(new URL("/?authError=config", origin));
  const response = NextResponse.redirect(new URL("/masuk/lanjut", origin));
  const client = await supabaseServer(response);
  const code = request.nextUrl.searchParams.get("code");
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type");
  const exchanged = code ? await client.auth.exchangeCodeForSession(code)
    : tokenHash && (type === "email" || type === "recovery") ? await client.auth.verifyOtp({ token_hash: tokenHash, type })
    : { error: new Error("Tautan tidak berlaku.") };
  if (exchanged.error) {
    response.headers.set("Location", new URL("/verifikasi-email/berhasil?error=invalid", origin).toString());
    return response;
  }
  const { data: { user } } = await client.auth.getUser();
  if (!user?.email || !user.email_confirmed_at) {
    response.headers.set("Location", new URL("/verifikasi-email/berhasil?error=invalid", origin).toString());
    return response;
  }
  try {
    if (type === "recovery" && tokenHash && !code) {
      response.cookies.set(RECOVERY_COOKIE, createRecoveryProof(user.id), { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 600 });
      response.headers.set("Location", new URL("/atur-password", origin).toString());
      return response;
    }
    const result = await provisionSupabaseRegistration(user);
    if (result.needsCompany) response.headers.set("Location", new URL("/register?google=1", origin).toString());
    else if (tokenHash) response.headers.set("Location", new URL("/verifikasi-email/berhasil", origin).toString());
  } catch (error) {
    console.error("Penyelesaian pendaftaran Supabase gagal:", error);
    response.headers.set("Location", new URL("/register?error=setup", origin).toString());
  }
  return response;
}
