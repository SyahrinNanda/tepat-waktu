"use client";

import Link from "next/link";
import { ArrowRight, Eye, EyeOff, LoaderCircle, LockKeyhole, Mail } from "lucide-react";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "@/lib/auth-client";
import { supabaseAuthEnabled, supabaseBrowser } from "@/lib/supabase/client";

export function LoginForm() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setLoading(true);
    setError("");

    let unconfirmedSupabase = false;
    try {
      if (supabaseAuthEnabled()) {
        const client = supabaseBrowser();
        const { error: supabaseError } = await client.auth.signInWithPassword({ email: String(form.get("email")), password: String(form.get("password")) });
        if (!supabaseError) { router.push("/masuk/lanjut"); router.refresh(); return; }
        unconfirmedSupabase = supabaseError.code === "email_not_confirmed";
        await client.auth.signOut();
      }
      const result = await signIn.email({
        email: String(form.get("email")),
        password: String(form.get("password")),
        rememberMe: form.get("remember") === "on",
        callbackURL: "/masuk/lanjut",
      });

      if (result.error) {
        if (unconfirmedSupabase && result.error.code !== "EMAIL_NOT_VERIFIED") {
          setError("Email belum diverifikasi. Buka tautan di kotak masuk Anda.");
        } else if (result.error.code === "EMAIL_NOT_VERIFIED") {
          setError("Akun lama belum diverifikasi. Hubungi administrator untuk bantuan aktivasi.");
        } else {
          setError(result.error.message ?? "Email atau password belum tepat.");
        }
      }
    } catch {
      setError("Tidak dapat menghubungi server autentikasi. Periksa alamat dan port aplikasi, lalu coba lagi.");
    } finally {
      setLoading(false);
    }
  }

  async function googleSignIn() {
    setLoading(true);
    setError("");
    try {
      const result = await supabaseBrowser().auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${window.location.origin}/auth/callback` } });
      if (result.error) setError("Login Google belum dikonfigurasi di Supabase Auth.");
    } catch {
      setError("Tidak dapat menghubungi server autentikasi.");
    } finally {
      setLoading(false);
    }
  }

  const googleEnabled = supabaseAuthEnabled();

  return (
    <form onSubmit={submit}>
      {error && <div className="error-box" role="alert">{error}</div>}
      <div className="field">
        <label htmlFor="email">Email</label>
        <div className="login-field-wrap"><Mail size={17} /><input className="input" id="email" name="email" type="email" placeholder="nama@perusahaan.com" autoComplete="email" required /></div>
      </div>
      <div className="field">
        <label htmlFor="password">Password</label>
        <div className="input-wrap login-field-wrap">
          <LockKeyhole size={17} />
          <input className="input password-input" id="password" name="password" type={showPassword ? "text" : "password"} placeholder="Masukkan password" autoComplete="current-password" minLength={8} required />
          <button type="button" className="icon-button input-icon" aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"} onClick={() => setShowPassword((value) => !value)}>
            {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
          </button>
        </div>
      </div>
      <div className="form-meta">
        <label className="check-row"><input name="remember" type="checkbox" /> Ingat saya</label>
        <Link href="/lupa-password" className="text-link">Lupa password?</Link>
      </div>
      <div className="auth-actions">
        <button className="btn btn-primary btn-block" disabled={loading}>
          {loading && <LoaderCircle size={16} className="spin" />}
          {loading ? "Memeriksa akun…" : "Masuk sekarang"}
          {!loading && <ArrowRight size={17} />}
        </button>
        <button className="btn btn-outline btn-block" type="button" disabled={!googleEnabled || loading} onClick={googleSignIn} title={googleEnabled ? undefined : "Isi URL dan publishable key Supabase di .env.local, lalu bangun ulang aplikasi"}>
          <span aria-hidden="true">G</span> Lanjutkan dengan Google
        </button>
      </div>
      <div className="auth-foot">
        Belum punya akun? <Link href="/register" className="text-link">Daftar di sini</Link><br />
        Ingin menghapus akun? <Link href="/penghapusan-akun" className="text-link">Ajukan di sini</Link>
      </div>
    </form>
  );
}
