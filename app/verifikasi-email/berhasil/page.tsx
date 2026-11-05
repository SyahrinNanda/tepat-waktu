import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { VerificationRedirect } from "@/components/verification-redirect";
import { ResendVerification } from "@/components/resend-verification";

export const metadata: Metadata = { title: "Email Terverifikasi" };

// Better Auth redirects here after the link in the verification email is opened (signed in on success).
export default async function Page({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const expired = error === "TOKEN_EXPIRED";
  return <main className="verification-page"><section className="verification-simple-card"><Link className="registration-brand" href="/">Tepat<span>Waktu</span></Link><p>Verifikasi Email</p>{error
    ? <><h1>{expired ? "Tautan sudah kedaluwarsa" : "Tautan tidak berlaku"}</h1><p>{expired ? "Tautan verifikasi berlaku 24 jam." : "Tautan verifikasi mungkin sudah digunakan atau tidak lengkap."} Masukkan email Anda untuk menerima tautan baru, atau langsung masuk jika akun sudah aktif.</p><ResendVerification /><Link className="btn btn-outline" href="/">Kembali ke login</Link></>
    : <><VerificationRedirect /><span className="verification-success-mark">✓</span><h1>Sukses!</h1><p>Email Anda berhasil diverifikasi dan ruang kerja perusahaan sudah siap. Mengarahkan ke dashboard…</p><Link className="btn btn-primary" href="/masuk/lanjut">Buka dashboard <ArrowRight size={16}/></Link></>}</section></main>;
}
