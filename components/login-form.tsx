"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, Eye, EyeOff, LoaderCircle, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authClient, signIn } from "@/lib/auth-client";

const RESEND_SECONDS = 30;

export function LoginForm() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  // "OTP Login" is on for this account: the password was right, now the emailed code is needed.
  const [step, setStep] = useState<"password" | "otp">("password");
  const [email, setEmail] = useState("");
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = window.setTimeout(() => setResendIn((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [resendIn]);

  async function sendCode() {
    const result = await authClient.twoFactor.sendOtp();
    if (result.error) {
      setError(result.error.status === 429 ? "Terlalu banyak permintaan kode. Tunggu sebentar lalu coba lagi." : "Kode belum bisa dikirim ke email Anda. Coba kirim ulang, atau masuk ulang dari awal.");
      return false;
    }
    setResendIn(RESEND_SECONDS);
    return true;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const address = String(form.get("email")).trim().toLowerCase();
    setLoading(true);
    setError("");
    setInfo("");

    try {
      const result = await signIn.email({
        email: address,
        password: String(form.get("password")),
        rememberMe: form.get("remember") === "on",
        callbackURL: "/masuk/lanjut",
      });
      if (result.error) {
        if (result.error.code === "EMAIL_NOT_VERIFIED") {
          // Better Auth (sendOnSignIn) has just emailed a fresh verification link.
          setError("Email belum diverifikasi. Kami sudah mengirim ulang tautan verifikasi ke email Anda; buka tautan itu untuk mengaktifkan akun.");
        } else if (result.error.code === "ACCOUNT_DISABLED" || result.error.status === 403) {
          // Status switched off by the company admin (lib/auth.ts databaseHooks).
          setError(result.error.message || "Akun Anda dinonaktifkan oleh admin perusahaan.");
        } else if (result.error.status === 429) {
          setError("Terlalu banyak percobaan masuk. Tunggu sebentar lalu coba lagi.");
        } else if ((result.error.status ?? 0) >= 500) {
          // Server/database failure: do not tell the user their password is wrong.
          setError("Server sedang bermasalah sehingga login belum bisa diproses. Coba lagi beberapa saat lagi atau hubungi admin TepatWaktu.");
        } else {
          setError("Email atau password belum tepat.");
        }
        return;
      }
      if (result.data && "twoFactorRedirect" in result.data && result.data.twoFactorRedirect) {
        setEmail(address);
        setStep("otp");
        if (await sendCode()) setInfo(`Kode 6 digit sudah dikirim ke ${address}. Kode berlaku 5 menit.`);
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

  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const code = String(form.get("code") ?? "").replace(/\D/g, "");
    if (code.length !== 6) { setError("Masukkan 6 digit kode dari email."); return; }
    setLoading(true);
    setError("");
    try {
      const result = await authClient.twoFactor.verifyOtp({ code, trustDevice: form.get("trust") === "on" });
      if (result.error) {
        if (result.error.code === "ACCOUNT_DISABLED" || result.error.status === 403) setError(result.error.message || "Akun Anda dinonaktifkan oleh admin perusahaan.");
        else if (result.error.status === 429 || /attempt|expired|cookie/i.test(result.error.code ?? "")) {
          setStep("password");
          setError("Sesi kode sudah berakhir atau terlalu banyak percobaan. Silakan masuk ulang.");
        } else setError("Kode tidak cocok atau sudah kedaluwarsa. Periksa email terbaru, atau kirim ulang kode.");
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

  async function resend() {
    setError("");
    setInfo("");
    if (await sendCode()) setInfo(`Kode baru dikirim ke ${email}.`);
  }

  if (step === "otp") {
    return (
      <form onSubmit={verify}>
        {error && <div className="error-box" role="alert">{error}</div>}
        {info && <div className="success-box" role="status">{info}</div>}
        <div className="login-otp-head">
          <ShieldCheck size={20} />
          <div><strong>Verifikasi login</strong><span>Akun ini memakai OTP Login. Masukkan kode dari email Anda.</span></div>
        </div>
        <div className="field">
          <label htmlFor="code">Kode verifikasi</label>
          <input className="input login-otp-input" id="code" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]*" maxLength={6} placeholder="••••••" autoFocus required />
        </div>
        <div className="form-meta">
          <label className="check-row"><input name="trust" type="checkbox" /> Percayai perangkat ini 30 hari</label>
          <button type="button" className="text-link login-link-button" onClick={resend} disabled={resendIn > 0 || loading}>
            {resendIn > 0 ? `Kirim ulang (${resendIn})` : "Kirim ulang kode"}
          </button>
        </div>
        <div className="auth-actions">
          <button className="btn btn-primary btn-block" disabled={loading}>
            {loading && <LoaderCircle size={16} className="spin" />}
            {loading ? "Memeriksa kode…" : "Verifikasi & masuk"}
            {!loading && <ArrowRight size={17} />}
          </button>
        </div>
        <div className="auth-foot">
          <button type="button" className="text-link login-link-button" onClick={() => { setStep("password"); setError(""); setInfo(""); }}>
            <ArrowLeft size={14} /> Kembali ke login
          </button>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={submit}>
      {error && <div className="error-box" role="alert">{error}</div>}
      <div className="field">
        <label htmlFor="email">Email</label>
        <div className="login-field-wrap"><Mail size={17} /><input className="input" id="email" name="email" type="email" placeholder="nama@perusahaan.com" autoComplete="email" defaultValue={email} required /></div>
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
