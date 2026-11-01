import Link from "next/link";
import { MailCheck } from "lucide-react";

export function VerificationEmailView({ email }: { email: string }) {
  return <main className="verification-page"><section className="verification-simple-card">
    <Link className="registration-brand" href="/">Tepat<span>Waktu</span></Link>
    <div className="registration-finish-icon" style={{ margin: "20px auto" }}><MailCheck size={36}/></div>
    <h1>Verifikasi Email</h1>
    <p>Tautan aktivasi telah dikirim ke <strong>{email || "email yang didaftarkan"}</strong>. Buka kotak masuk dan klik tautan untuk mengaktifkan akun.</p>
    <p>Periksa juga folder spam. Jika tautan kedaluwarsa, hubungi administrator.</p>
    <Link className="btn btn-outline" href="/">Kembali ke login</Link>
  </section></main>;
}
