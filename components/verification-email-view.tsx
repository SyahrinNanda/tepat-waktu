"use client";
import Link from "next/link";
import { MailCheck, RefreshCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export function VerificationEmailView({ email, initialWaitSeconds }: { email: string; initialWaitSeconds: number }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [waitSeconds, setWaitSeconds] = useState(initialWaitSeconds);
  const nextAllowedAt = useRef<number | null>(null);

  useEffect(() => {
    if (waitSeconds <= 0) return;
    if (nextAllowedAt.current === null) nextAllowedAt.current = Date.now() + waitSeconds * 1000;
    const expiresAt = nextAllowedAt.current;
    const timer = window.setTimeout(() => setWaitSeconds(Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000))), 1000);
    return () => window.clearTimeout(timer);
  }, [waitSeconds]);

  async function resend() {
    if (!email) { setError("Alamat email tidak ditemukan. Masukkan email pada halaman login terlebih dahulu."); return; }
    if (waitSeconds > 0 || loading) return;
    setLoading(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/verification/resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const result = await response.json() as { message?: string; retryAfter?: number };
      if (response.status === 429 && result.retryAfter) {
        nextAllowedAt.current = Date.now() + result.retryAfter * 1000;
        setWaitSeconds(result.retryAfter);
      }
      if (!response.ok) setError(result.message || "Email verifikasi belum dapat dikirim.");
      else {
        setMessage(result.message || "Tautan verifikasi baru telah dikirim.");
        const seconds = result.retryAfter || 60;
        nextAllowedAt.current = Date.now() + seconds * 1000;
        setWaitSeconds(seconds);
      }
    } catch { setError("Tidak dapat menghubungi server. Coba lagi beberapa saat."); }
    finally { setLoading(false); }
  }
  return <main className="verification-page"><section className="verification-simple-card"><Link className="registration-brand" href="/">Tepat<span>Waktu</span></Link><div className="registration-finish-icon" style={{ margin: "20px auto" }}><MailCheck size={36}/></div><h1>Verifikasi Email</h1><p>Akun <strong>{email || "yang didaftarkan"}</strong> perlu diverifikasi melalui tautan email. Jika email sudah terkirim, periksa kotak masuk dan klik tautannya.</p><p>Tautan berlaku selama 30 menit. Periksa juga folder spam.</p>{error && <div className="error-box" role="alert">{error}</div>}{message && <p role="status">{message}</p>}<button className="btn btn-primary" type="button" onClick={resend} disabled={loading || !email || waitSeconds > 0}><RefreshCw size={16}/>{loading ? "Mengirim..." : waitSeconds > 0 ? `Kirim ulang dalam ${waitSeconds} detik` : "Kirim ulang email"}</button><div><Link className="btn btn-outline" href="/">Kembali ke login</Link></div></section></main>;
}
