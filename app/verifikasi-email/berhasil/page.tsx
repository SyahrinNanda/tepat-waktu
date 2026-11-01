import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { VerificationRedirect } from "@/components/verification-redirect";

export const metadata: Metadata = { title: "Email Terverifikasi" };

export default async function Page({ searchParams }: { searchParams: Promise<{ error?: string; email?: string }> }) {
  const { error, email = "" } = await searchParams;
  return <main className="verification-page"><section className="verification-simple-card"><Link className="registration-brand" href="/">Tepat<span>Waktu</span></Link><p>Verifikasi Email</p>{error ? <><h1>Tautan tidak berlaku</h1><p>Tautan verifikasi mungkin kedaluwarsa atau sudah digunakan. Hubungi administrator untuk bantuan.</p><Link className="btn btn-primary" href="/">Kembali ke login <ArrowRight size={16}/></Link></> : <><VerificationRedirect/><span className="verification-success-mark">✓</span><h1>Sukses!</h1><p>Email {email ? <strong>{email}</strong> : "Anda"} berhasil diverifikasi. Mengarahkan ke halaman login dalam beberapa detik.</p><Link className="btn btn-primary" href="/">Masuk sekarang <ArrowRight size={16}/></Link></>}</section></main>;
}
