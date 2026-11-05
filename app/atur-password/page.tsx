import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { PasswordResetForm } from "@/components/password-reset-form";

export const metadata: Metadata = { title: "Atur password baru" };

// Opened from the reset email: Better Auth redirects here with ?token=… (or ?error=INVALID_TOKEN).
export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string; error?: string }> }) {
  const { token, error } = await searchParams;
  return <AuthShell variant="login"><div className="auth-main login-auth-main">
    <span className="login-form-kicker">PEMULIHAN AKUN</span><h1>Atur password baru</h1>
    {token && !error ? <>
      <p className="login-form-lead">Gunakan password baru untuk masuk ke akun TepatWaktu.</p>
      <PasswordResetForm token={token} />
    </> : <>
      <div className="error-box" role="alert">Tautan atur ulang password tidak berlaku atau sudah kedaluwarsa (berlaku 1 jam dan hanya sekali pakai).</div>
      <p className="auth-foot"><Link className="text-link" href="/lupa-password">Minta tautan baru</Link> · <Link className="text-link" href="/">Kembali ke login</Link></p>
    </>}
  </div></AuthShell>;
}
