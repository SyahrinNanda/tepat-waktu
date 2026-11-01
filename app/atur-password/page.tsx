import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { PasswordResetForm } from "@/components/password-reset-form";
import { RECOVERY_COOKIE, validRecoveryProof } from "@/lib/supabase/recovery";
import { supabaseServer, supabaseServerConfigured } from "@/lib/supabase/server";

export default async function ResetPasswordPage() {
  if (!supabaseServerConfigured()) redirect("/");
  const client = await supabaseServer();
  const { data: { user } } = await client.auth.getUser();
  const proof = (await cookies()).get(RECOVERY_COOKIE)?.value;
  if (!user || !validRecoveryProof(proof, user.id)) redirect("/");

  return <AuthShell variant="login"><div className="auth-main login-auth-main">
    <span className="login-form-kicker">PEMULIHAN AKUN</span><h1>Atur password baru</h1>
    <p className="login-form-lead">Gunakan password baru untuk masuk ke akun TepatWaktu.</p>
    <PasswordResetForm />
  </div></AuthShell>;
}
