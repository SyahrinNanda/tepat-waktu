"use client";

import Link from "next/link";
import { ArrowRight, Eye, EyeOff, LoaderCircle, LockKeyhole, Mail } from "lucide-react";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "@/lib/auth-client";

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

    try {
      const result = await signIn.email({
        email: String(form.get("email")).trim().toLowerCase(),
        password: String(form.get("password")),
        rememberMe: form.get("remember") === "on",
        callbackURL: "/masuk/lanjut",
      });
      if (result.error) {
        if (result.error.code === "EMAIL_NOT_VERIFIED") {
          // Better Auth (sendOnSignIn) has just emailed a fresh verification link.
          setError("Email belum diverifikasi. Kami sudah mengirim ulang tautan verifikasi ke email Anda; buka tautan itu untuk mengaktifkan akun.");
        } else if (result.error.status === 429) {
          setError("Terlalu banyak percobaan masuk. Tunggu sebentar lalu coba lagi.");
        } else {
          setError("Email atau password belum tepat.");
        }
        return;
      }
      router.push("/masuk/lanjut");
      router.refresh();
    } catch {
      setError("Tidak dapat menghubungi server autentikasi. Periksa koneksi lalu coba lagi.");
    } finally {
      setLoading(false);
    }
  }

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
      </div>
      <div className="auth-foot">
        Belum punya akun? <Link href="/register" className="text-link">Daftar di sini</Link><br />
        Ingin menghapus akun? <Link href="/penghapusan-akun" className="text-link">Ajukan di sini</Link>
      </div>
    </form>
  );
}
