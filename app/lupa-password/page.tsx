import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { AuthShell } from "@/components/auth-shell";
import { RequestForm } from "@/features/account-requests/components/request-form";

export const metadata: Metadata = { title: "Lupa password" };

export default function ForgotPasswordPage() {
  return (
    <AuthShell><div className="auth-main">
      <Link href="/" className="text-link" style={{ display: "inline-flex", gap: 7, alignItems: "center", marginBottom: 24 }}><ArrowLeft size={15} /> Kembali</Link>
      <h1>Lupa password?</h1>
      <p className="lead">Masukkan email akun Anda. Demi keamanan, respons kami tidak akan mengungkap apakah email terdaftar.</p>
      <RequestForm type="password" />
    </div></AuthShell>
  );
}
